; Inno Setup Script for Gitero IDE Production Installer
; Generates a lightweight (~3.5MB) native Windows Installer with desktop icon, Start menu, and "Open with Gitero" context menu.

#define MyAppName "Gitero IDE"
#define MyAppVersion "0.1.0-beta"
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
ChangesEnvironment=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "contextmenu"; Description: "Add 'Open with Gitero' to Windows Explorer context menu"; GroupDescription: "Windows Explorer Integration:"
Name: "addtopath"; Description: "Add Gitero to PATH (allows 'gcode .' from Terminal / CMD / PowerShell)"; GroupDescription: "Terminal Integration:"

[Files]
; Primary application executable and packaged resources
Source: "..\dist\gitero\gitero-win_x64.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion
Source: "..\dist\gitero\resources.neu"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\neutralino.config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\public\icons\appIcon.ico"; DestDir: "{app}"; Flags: ignoreversion
; CLI Terminal Launcher scripts
Source: "..\bin\gcode.cmd"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\bin\gcode"; DestDir: "{app}\bin"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; 1. Right-click ANY FILE context menu: "Open with Gitero"
Root: HKCU; Subkey: "Software\Classes\*\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\*\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\{#MyAppExeName}"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\*\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

; 2. Right-click DIRECTORY / FOLDER context menu: "Open with Gitero"
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\{#MyAppExeName}"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

; 3. Right-click DIRECTORY BACKGROUND context menu (inside empty space)
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\{#MyAppExeName}"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%V"""; Tasks: contextmenu

; 4. Right-click DRIVE context menu (C:, D:)
Root: HKCU; Subkey: "Software\Classes\Drive\shell\GiteroIDE"; ValueType: string; ValueData: "Open with Gitero"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Drive\shell\GiteroIDE"; ValueType: string; ValueName: "Icon"; ValueData: """{app}\{#MyAppExeName}"""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Drive\shell\GiteroIDE\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

; 5. Windows Official "Open With" Application List
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "{#MyAppName}"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".*"; ValueData: ""; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: contextmenu

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
const
  EnvironmentKey = 'Environment';

procedure RegisterPath();
var
  Paths: string;
  AppDir: string;
begin
  if WizardIsTaskSelected('addtopath') then
  begin
    AppDir := ExpandConstant('{app}\bin');
    if RegQueryStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths) then
    begin
      if Pos(Uppercase(AppDir), Uppercase(Paths)) = 0 then
      begin
        if (Length(Paths) > 0) and (Paths[Length(Paths)] <> ';') then
          Paths := Paths + ';';
        Paths := Paths + AppDir;
        RegWriteStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths);
      end;
    end
    else
    begin
      RegWriteStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', AppDir);
    end;
  end;
end;

procedure UnregisterPath();
var
  Paths: string;
  AppDir: string;
  P: Integer;
begin
  AppDir := ExpandConstant('{app}\bin');
  if RegQueryStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths) then
  begin
    P := Pos(Uppercase(AppDir), Uppercase(Paths));
    if P > 0 then
    begin
      Delete(Paths, P, Length(AppDir));
      StringChange(Paths, ';;', ';');
      if (Length(Paths) > 0) and (Paths[Length(Paths)] = ';') then
        Delete(Paths, Length(Paths), 1);
      if (Length(Paths) > 0) and (Paths[1] = ';') then
        Delete(Paths, 1, 1);
      RegWriteStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    RegisterPath();
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    UnregisterPath();
  end;
end;
