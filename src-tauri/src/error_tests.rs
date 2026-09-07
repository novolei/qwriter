use super::*;

#[test]
fn errors_cross_ipc_with_a_stable_discriminator() {
    let error = AppError::Conflict("stale revision".into());
    let value = serde_json::to_value(error).unwrap();
    assert_eq!(
        value,
        serde_json::json!({"code":"conflict","message":"stale revision"})
    );
    let decoded: AppError = serde_json::from_value(value).unwrap();
    assert!(matches!(decoded, AppError::Conflict(_)));
}

#[test]
fn json_conversion_does_not_echo_external_input() {
    let error = serde_json::from_str::<serde_json::Value>("PRIVATE-INPUT").unwrap_err();
    let public = serde_json::to_string(&AppError::from(error)).unwrap();
    assert!(!public.contains("PRIVATE-INPUT"));
    assert!(public.contains("validation"));
}
