use std::fs;
use std::path::{Path, PathBuf};

use crate::error::AppError;

/// 文本/代码文件最大读取大小（10MB，保险丝）
pub const MAX_TEXT_SIZE: u64 = 10 * 1024 * 1024;

/// 读取文本文件：大小预检 + UTF-8 校验 + BOM 剥离（使用默认上限）
pub fn read_text(path: &Path) -> Result<String, AppError> {
    read_text_with_limit(path, None)
}

/// 读取文本文件：大小预检 + UTF-8 校验 + BOM 剥离
pub fn read_text_with_limit(path: &Path, max_size: Option<u64>) -> Result<String, AppError> {
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
    String::from_utf8(bytes.to_vec()).map_err(|_| AppError::EncodingNotSupported {
        path: path.display().to_string(),
    })
}

/// 原子写：同目录临时文件 + rename；失败清理临时文件
pub fn write_text(path: &Path, content: &str) -> Result<(), AppError> {
    let dir = path
        .parent()
        .ok_or_else(|| AppError::Io(std::io::Error::other("路径无父目录")))?;
    let tmp: PathBuf = dir.join(format!(
        ".gitpad-tmp-{}-{}",
        std::process::id(),
        rand_suffix()
    ));
    let write_result = fs::write(&tmp, content.as_bytes());
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
        assert_eq!(read_text(&f).unwrap(), "hello 世界");
    }

    #[test]
    fn strips_utf8_bom() {
        let root = setup("bom");
        let f = root.join("b.txt");
        fs::write(&f, [0xEF, 0xBB, 0xBF, b'h', b'i']).unwrap();
        assert_eq!(read_text(&f).unwrap(), "hi");
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
    fn rejects_non_utf8() {
        let root = setup("enc");
        let f = root.join("gbk.txt");
        fs::write(&f, [0xB2, 0xE2, 0xCA, 0xD4]).unwrap(); // GBK 字节
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
        write_text(&f, "new content").unwrap();
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
    fn write_fails_when_dir_missing() {
        let root = setup("nomiss");
        let f = root.join("nope").join("w.txt");
        assert!(matches!(write_text(&f, "x"), Err(AppError::Io(_))));
    }
}
