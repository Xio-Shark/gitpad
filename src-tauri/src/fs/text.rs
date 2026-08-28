use std::fs;
use std::path::{Path, PathBuf};

use crate::error::AppError;

/// 文本/代码文件最大读取大小（10MB，保险丝）
pub const MAX_TEXT_SIZE: u64 = 10 * 1024 * 1024;

/// 读取文本文件：大小预检 + 编码检测 + BOM 剥离（使用默认上限）
///
/// 返回 (内容, 编码标识)。UTF-8 校验失败时按 GBK（GB18030 解码规则）尝试，
/// 覆盖常见中文本地文件；仍失败才报 EncodingNotSupported。
pub fn read_text(path: &Path) -> Result<(String, &'static str), AppError> {
    read_text_with_limit(path, None)
}

/// 读取文本文件：大小预检 + 编码检测 + BOM 剥离
pub fn read_text_with_limit(path: &Path, max_size: Option<u64>) -> Result<(String, &'static str), AppError> {
    if !path.exists() {
        return Err(AppError::NotFound(path.display().to_string()));
    }
    if !path.is_file() {
        return Err(AppError::NotFile(path.display().to_string()));
    }
    let limit = max_size.unwrap_or(MAX_TEXT_SIZE);
    let meta = fs::metadata(path)?;
    if meta.len() > limit {
        return Err(AppError::FileTooLarge { limit });
    }
    let bytes = fs::read(path)?;
    // UTF-8 BOM 剥离
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes);
    if let Ok(s) = std::str::from_utf8(bytes) {
        return Ok((s.to_string(), "utf-8"));
    }
    // GBK 解码：had_errors 表示出现了替换字符（非法序列），此时判定不支持
    let (decoded, had_errors) = encoding_rs::GBK.decode_without_bom_handling(bytes);
    if had_errors {
        return Err(AppError::EncodingNotSupported {
            path: path.display().to_string(),
        });
    }
    Ok((decoded.into_owned(), "gbk"))
}

/// 原子写：按指定编码编码后写同目录临时文件 + rename；失败清理临时文件。
/// 编码标识 "gbk" 时保持原编码写回（避免 GBK 文件保存后变 UTF-8 导致整文件 diff），其余按 UTF-8。
pub fn write_text(path: &Path, content: &str, encoding: &str) -> Result<(), AppError> {
    let bytes: Vec<u8> = match encoding {
        "gbk" => encoding_rs::GBK.encode(content).0.into_owned(),
        _ => content.as_bytes().to_vec(),
    };
    let dir = path
        .parent()
        .ok_or_else(|| AppError::Io(std::io::Error::other("路径无父目录")))?;
    let tmp: PathBuf = dir.join(format!(
        ".gitpad-tmp-{}-{}",
        std::process::id(),
        rand_suffix()
    ));
    let write_result = fs::write(&tmp, &bytes);
    match write_result {
        Ok(()) => {
            fs::rename(&tmp, path)?;
            Ok(())
        }
        Err(e) => {
            let _ = fs::remove_file(&tmp);
            Err(AppError::Io(e))
        }
    }
}

fn rand_suffix() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("gitpad-text-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn reads_utf8_text() {
        let root = setup("read");
        let f = root.join("a.txt");
        fs::write(&f, "hello 世界").unwrap();
        let (content, encoding) = read_text(&f).unwrap();
        assert_eq!(content, "hello 世界");
        assert_eq!(encoding, "utf-8");
    }

    #[test]
    fn strips_utf8_bom() {
        let root = setup("bom");
        let f = root.join("b.txt");
        fs::write(&f, [0xEF, 0xBB, 0xBF, b'h', b'i']).unwrap();
        let (content, encoding) = read_text(&f).unwrap();
        assert_eq!(content, "hi");
        assert_eq!(encoding, "utf-8");
    }

    #[test]
    fn rejects_file_too_large() {
        let root = setup("large");
        let f = root.join("big.txt");
        // 写一个 >10MB 的稀疏文件（metadata.len() 即判定依据）
        let fh = fs::File::create(&f).unwrap();
        fh.set_len(MAX_TEXT_SIZE + 1).unwrap();
        drop(fh);
        match read_text(&f) {
            Err(AppError::FileTooLarge { limit }) => assert_eq!(limit, MAX_TEXT_SIZE),
            other => panic!("期望 FileTooLarge，得到 {other:?}"),
        }
    }

    #[test]
    fn reads_gbk_text() {
        let root = setup("enc");
        let f = root.join("gbk.txt");
        fs::write(&f, [0xB2, 0xE2, 0xCA, 0xD4]).unwrap(); // GBK 字节 = "测试"
        let (content, encoding) = read_text(&f).unwrap();
        assert_eq!(content, "测试");
        assert_eq!(encoding, "gbk");
    }

    #[test]
    fn rejects_random_binary() {
        let root = setup("bin");
        let f = root.join("bin.dat");
        // 非 UTF-8 也非合法 GBK 的字节序列（0x80 是 GBK 中不完整的 lead byte）
        fs::write(&f, [0x80, 0xFF, 0x00, 0x81]).unwrap();
        assert!(matches!(
            read_text(&f),
            Err(AppError::EncodingNotSupported { .. })
        ));
    }

    #[test]
    fn write_atomically_overwrites() {
        let root = setup("write");
        let f = root.join("w.txt");
        fs::write(&f, "old").unwrap();
        write_text(&f, "new content", "utf-8").unwrap();
        assert_eq!(fs::read_to_string(&f).unwrap(), "new content");
        // 无残留临时文件
        let leftovers: Vec<_> = fs::read_dir(&root)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with(".gitpad-tmp-"))
            .collect();
        assert!(leftovers.is_empty(), "临时文件未清理");
    }

    #[test]
    fn write_gbk_keeps_encoding() {
        let root = setup("gbkwrite");
        let f = root.join("g.txt");
        write_text(&f, "测试内容", "gbk").unwrap();
        let bytes = fs::read(&f).unwrap();
        assert_eq!(bytes, [0xB2, 0xE2, 0xCA, 0xD4, 0xC4, 0xDA, 0xC8, 0xDD]); // GBK 原字节
    }

    #[test]
    fn write_fails_when_dir_missing() {
        let root = setup("nomiss");
        let f = root.join("nope").join("w.txt");
        assert!(matches!(write_text(&f, "x", "utf-8"), Err(AppError::Io(_))));
    }
}
