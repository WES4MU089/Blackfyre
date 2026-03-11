!macro customCheckAppRunning
  ; Override the default "app is running" check to skip it entirely.
  ; NSIS was falsely detecting the installer itself as a running instance.
!macroend
