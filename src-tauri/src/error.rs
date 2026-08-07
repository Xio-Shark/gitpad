use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("path not found: {0}")]
    NotFound(String),
    #[error("not a directory: {0}")]
    NotDirectory(String),
}

impl AppError {
    fn code(&self) -> &'static str {
        match self {
            AppError::Io(_) => "io",
            AppError::NotFound(_) => "not_found",
            AppError::NotDirectory(_) => "not_directory",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}
