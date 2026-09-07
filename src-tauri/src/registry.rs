// One command inventory drives runtime dispatch, TypeScript export and ACL generation.
macro_rules! registered_commands {
    ($($registry:ident)::+) => { $($registry)::+![
        provider::ai_complete, provider::list_models, provider::model_verify, provider::comfy_request,
        library::library_load, library::library_save, library::library_history,
        git::git_inspect, git::git_file_diff, git::git_init, git::git_commit,
        streaming::ai_stream, streaming::ai_cancel,
        agent::agent_run, agent::agent_cancel,
        knowledge::memory_list, knowledge::memory_save, knowledge::memory_search,
        knowledge::agent_session_save, knowledge::agent_sessions,
        credentials::credential_read, credentials::credential_write, credentials::credential_remove,
        media::media_pick, media::media_import, media::media_asset, media::media_path, media::media_export, media::link_preview, media::open_external,
        cards::cards_list, cards::card_save,
        capture::capture_open, capture::capture_take, capture::capture_clipboard, capture::capture_screens, capture::capture_release, capture::capture_shortcut_errors,
        capture::capture_window, capture::capture_insert, capture::capture_pending_insert, capture::capture_pin, capture::capture_pinned,
        capture::capture_environment, capture::capture_request_access,
    ] };
}
pub(crate) use registered_commands;
