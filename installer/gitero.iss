; Inno Setup Script for Gitero IDE Production Installer
; Generates a lightweight (~3.5MB) native Windows Installer with desktop icon, Start menu, and "Open with Gitero" context menu.

#define MyAppName "Gitero IDE"
#define MyAppVersion "0.0.4-alpha"
#define MyAppPublisher "Gitero Team"
#define MyAppURL "https://github.com/iharshraj1123/Glitero-IDE"
#define MyAppExeName "Gitero.exe"

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
; Primary application executable and packaged resources
Source: "..\dist\gitero\gitero-win_x64.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion
Source: "..\dist\gitero\resources.neu"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\neutralino.config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\public\icons\appIcon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\appIcon.ico"; IconIndex: 0
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\appIcon.ico"; IconIndex: 0; Tasks: desktopicon

[Registry]
; 1. Right-click ANY FILE context menu: "Open with Gitero"
Root: HKCU; Subkey: "Software\Classes\*\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\*\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\appIcon.ico"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\*\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

; 2. Right-click DIRECTORY / FOLDER context menu: "Open with Gitero"
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\appIcon.ico"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

; 3. Right-click DIRECTORY BACKGROUND context menu (inside empty space)
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\appIcon.ico"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%V"""; Tasks: contextmenu

; 4. Right-click DRIVE context menu (C:, D:)
Root: HKCU; Subkey: "Software\Classes\Drive\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Drive\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\appIcon.ico"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Drive\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

; 5. Windows Official "Open With" Application List
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "{#MyAppName}"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".*"; ValueData: ""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
