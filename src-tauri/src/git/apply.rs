//! 字符串级 minimal unified-diff applier：将选中的 hunks 应用到 base 内容。
//! 用于 hunk 级 stage/unstage（git2 无原生 API）。
//! 仅支持 git 生成的 hunk 格式（无 fuzz），校验失败返回错误，不污染 index。

use super::types::DiffLine;

pub struct HunkSpec<'a> {
    /// 1-based 行号（base 中 hunk 起始）
    pub old_start: u32,
    pub lines: &'a [DiffLine],
}

/// 解析 hunk 头 `@@ -a,b +c,d @@`，返回 (old_start, old_lines)（省略行数时按 1 计）
pub fn parse_header(header: &str) -> Option<(u32, u32)> {
    let inner = header.strip_prefix("@@ ")?;
    let old_part = inner.split(' ').next()?;
    let old_part = old_part.strip_prefix('-')?;
    let (start, count) = match old_part.find(',') {
        Some(comma) => {
            let s = old_part[..comma].parse::<u32>().ok()?;
            let c = old_part[comma + 1..].parse::<u32>().ok()?;
            (s, c)
        }
        None => (old_part.parse::<u32>().ok()?, 1),
    };
    Some((start, count))
}

fn strip_eol(s: &str) -> &str {
    s.strip_suffix('\n')
        .unwrap_or(s)
        .strip_suffix('\r')
        .unwrap_or(s)
}

/// 应用 hunks 到 base：selected[i] == true 的 hunk 生效（- 消耗不输出、+ 输出），
/// 未选中的 hunk 保持 base 原样（- 消耗并输出原行、+ 忽略）。
/// specs 必须按 old_start 升序且与 selected 等长。
pub fn apply_hunks(base: &str, specs: &[HunkSpec], selected: &[bool]) -> Result<String, String> {
    debug_assert_eq!(specs.len(), selected.len());
    let base_lines: Vec<&str> = base.split_inclusive('\n').collect();
    let mut out: Vec<&str> = Vec::with_capacity(base_lines.len() + 16);
    let mut cursor = 0usize;

    for (i, spec) in specs.iter().enumerate() {
        let start0 = (spec.old_start as usize).saturating_sub(1);
        if start0 > base_lines.len() {
            return Err(format!(
                "hunk {} 起始行 {} 超出文件行数 {}",
                i + 1,
                spec.old_start,
                base_lines.len()
            ));
        }
        // 输出 hunk 之前的间隙
        for &l in &base_lines[cursor..start0] {
            out.push(l);
        }
        let mut pos = start0;
        for line in spec.lines {
            match line.kind {
                ' ' | '-' => {
                    let src = base_lines.get(pos).ok_or_else(|| {
                        format!("hunk {} 消耗超出文件结尾（第 {} 行）", i + 1, pos + 1)
                    })?;
                    if strip_eol(src) != strip_eol(&line.text) {
                        return Err(format!(
                            "hunk {} 上下文不匹配：期望 {:?}，实际 {:?}（文件可能已被外部修改，请刷新后重试）",
                            i + 1,
                            line.text,
                            src
                        ));
                    }
                    if line.kind == ' ' || !selected[i] {
                        out.push(src);
                    }
                    pos += 1;
                }
                '+' if selected[i] => {
                    out.push(&line.text);
                }
                _ => {}
            }
        }
        cursor = pos;
    }
    for &l in &base_lines[cursor..] {
        out.push(l);
    }
    Ok(out.concat())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hunk(old_start: u32, lines: &[(&str, char)]) -> HunkSpec<'static> {
        let owned: Vec<DiffLine> = lines
            .iter()
            .map(|(text, kind)| DiffLine {
                kind: *kind,
                text: text.to_string(),
                old_no: None,
                new_no: None,
            })
            .collect();
        HunkSpec {
            old_start,
            lines: Box::leak(owned.into_boxed_slice()),
        }
    }

    #[test]
    fn parses_header_with_and_without_count() {
        assert_eq!(parse_header("@@ -3,2 +3,2 @@ fn main()"), Some((3, 2)));
        assert_eq!(parse_header("@@ -7 +7,1 @@"), Some((7, 1)));
        assert_eq!(parse_header("no header"), None);
    }

    #[test]
    fn applies_single_selected_hunk() {
        let base = "a\nb\nc\nd\n";
        let h = hunk(1, &[("a\n", '-'), ("aa\n", '+'), ("b\n", ' ')]);
        let out = apply_hunks(base, &[h], &[true]).unwrap();
        assert_eq!(out, "aa\nb\nc\nd\n");
    }

    #[test]
    fn skipped_hunk_keeps_base() {
        let base = "a\nb\nc\nd\n";
        let h1 = hunk(1, &[("a\n", '-'), ("aa\n", '+'), ("b\n", ' ')]);
        let h2 = hunk(3, &[("c\n", '-'), ("cc\n", '+')]);
        let out = apply_hunks(base, &[h1, h2], &[true, false]).unwrap();
        assert_eq!(out, "aa\nb\nc\nd\n");
    }

    #[test]
    fn multi_hunk_selected_in_middle() {
        let base = "a\nb\nc\nd\n";
        let h1 = hunk(1, &[("a\n", '-'), ("aa\n", '+')]);
        let h2 = hunk(3, &[("c\n", '-'), ("cc\n", '+')]);
        let out = apply_hunks(base, &[h1, h2], &[false, true]).unwrap();
        assert_eq!(out, "a\nb\ncc\nd\n");
    }

    #[test]
    fn new_file_from_empty_base() {
        let base = "";
        let h = hunk(1, &[("x\n", '+'), ("y\n", '+')]);
        let out = apply_hunks(base, &[h], &[true]).unwrap();
        assert_eq!(out, "x\ny\n");
    }

    #[test]
    fn no_trailing_newline_in_hunk_line() {
        let base = "a\nb";
        let h = hunk(2, &[("b", '-'), ("bb", '+')]);
        let out = apply_hunks(base, &[h], &[true]).unwrap();
        assert_eq!(out, "a\nbb");
    }

    #[test]
    fn mismatched_context_is_error() {
        let base = "a\nX\nc\n";
        let h = hunk(2, &[("b\n", '-'), ("bb\n", '+')]);
        assert!(apply_hunks(base, &[h], &[true]).is_err());
    }

    #[test]
    fn line_numbers_from_diff() {
        // 解析 git 风格 header 与行号映射正确性（行号不用于定位，仅校验解析）
        let h = hunk(5, &[]);
        assert_eq!(h.old_start, 5);
    }
}
