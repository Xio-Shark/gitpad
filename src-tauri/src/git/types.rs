use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Change {
    pub path: String,
    /// 单字符状态：A 新增 / M 修改 / D 删除 / R 重命名 / ? 未跟踪
    pub status: String,
    pub staged: bool,
    pub untracked: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct DiffLine {
    /// ' ' 上下文 / '+' 新增 / '-' 删除
    pub kind: char,
    pub text: String,
    pub old_no: Option<u32>,
    pub new_no: Option<u32>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Hunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct DiffFile {
    pub path: String,
    pub hunks: Vec<Hunk>,
    pub is_new: bool,
    pub is_deleted: bool,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusData {
    pub is_git: bool,
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub changes: Vec<Change>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefInfo {
    pub name: String,
    pub oid: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommitInfo {
    pub oid: String,
    pub short: String,
    pub message: String,
    pub author: String,
    pub time: i64,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HistoryData {
    pub refs: Vec<RefInfo>,
    pub commits: Vec<CommitInfo>,
}
