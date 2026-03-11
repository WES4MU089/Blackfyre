!macro customInit
  ; Kill any running instance of the app before installing
  nsExec::ExecToLog 'taskkill /f /im "Dragon'"'"'s Dominion.exe"'
!macroend
