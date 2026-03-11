; Override the default "is app running?" check entirely.
; The default CHECK_APP_RUNNING uses isFileLocked on the installed exe,
; which false-positives when Windows Search indexer or AV holds a handle.
!macro customCheckAppRunning
  ; No-op: skip the running-app check completely
!macroend
