; Inno Setup Script for Gitero IDE Production Installer
; Generates a lightweight (~4-5MB) Windows Installer with desktop icon, Start menu, and "Open with Gitero" context menu.

#define MyAppName "Gitero IDE"
#define MyAppVersion "0.0.1-alpha"
#define MyAppPublisher "Gitero Team"
#define MyAppURL "https://github.com/iharshraj1123/Glitero-IDE"
#define MyAppExeName "gitero-win_x64.exe"

[Setup]
; Per-user installation in Local AppData allows in-app updates without UAC elevation prompts
AppId={{D37F2F11-4E89-4D2F-A0C3-8B3751C0F59A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\Gitero IDE
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\installer-output
OutputBaseFilename=Gitero-Setup-{#MyAppVersion}
SetupIconFile=..\public\icons\appIcon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "contextmenu"; Description: "Add 'Open with Gitero' to Windows Explorer context menu"; GroupDescription: "Windows Explorer Integration:"

[Files]
Source: "..\bin\{#MyAppExeName}"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\bin\neutralino-win_x64.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\neutralino.config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Gitero.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\Gitero.bat"; IconFilename: "{app}\dist\icons\appIcon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\Gitero.bat"; IconFilename: "{app}\dist\icons\appIcon.ico"; Tasks: desktopicon

[Registry]
; Right-click directory context menu: "Open with Gitero"
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\dist\icons\appIcon.ico"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\Gitero.bat"" ""%1"""; Tasks: contextmenu

; Right-click background context menu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\dist\icons\appIcon.ico"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\Gitero.bat"" ""%V"""; Tasks: contextmenu

[Run]
Filename: "{app}\Gitero.bat"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall nowait skipifsilent
