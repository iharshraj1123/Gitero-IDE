; Inno Setup Script for Gitero IDE Production Installer
; Generates a lightweight (~3.5MB) native Windows Installer with desktop icon, Start menu, and "Open with Gitero" context menu.

#define MyAppName "Gitero IDE"
#define MyAppVersion "0.3.0-beta"
#define MyAppPublisher "Gitero Team"
#define MyAppURL "https://github.com/iharshraj1123/Gitero-IDE"
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
ChangesAssociations=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "contextmenu"; Description: "Add 'Open with Gitero' to Windows Explorer context menu"; GroupDescription: "Windows Explorer Integration:"
Name: "explorer_hotkey"; Description: "Enable Ctrl+. shortcut in Windows Explorer to open active folder in Gitero"; GroupDescription: "Windows Explorer Integration:"; Flags: checkedonce
Name: "addtopath"; Description: "Add Gitero to PATH (allows 'gcode .' from Terminal / CMD / PowerShell)"; GroupDescription: "Terminal Integration:"
Name: "assoc_md"; Description: "Register Gitero as default viewer for Markdown files (.md, .markdown)"; GroupDescription: "File Associations:"; Flags: checkedonce
Name: "assoc_code"; Description: "Register Gitero for source code and script files (.js, .ts, .py, .html, .css, .json, etc.)"; GroupDescription: "File Associations:"; Flags: unchecked
Name: "assoc_txt"; Description: "Register Gitero for plain text files (.txt, .log)"; GroupDescription: "File Associations:"; Flags: unchecked

[Files]
; Primary application executable and packaged resources
Source: "..\dist\gitero\gitero-win_x64.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion
Source: "..\dist\gitero\resources.neu"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\neutralino.config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\public\icons\appIcon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\public\icons\file-types\*.ico"; DestDir: "{app}\icons\file-types"; Flags: ignoreversion
; CLI Terminal Launcher scripts
Source: "..\bin\gcode.cmd"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\bin\gcode"; DestDir: "{app}\bin"; Flags: ignoreversion
; Windows Explorer Hotkey Companion (Ctrl+.) and DWM Transparency Helper
Source: "..\bin\gitero_explorer_hotkey.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\bin\glitero_explorer_hotkey.exe"; DestDir: "{app}\bin"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

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

; 5. Windows Official "Open With" Application List & Default Document Icon
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "{#MyAppName}"
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\icons\file-types\document.ico"
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document.ico"
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".*"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

; 6. Dedicated Document ProgIDs & File Type Associations
; Markdown
Root: HKCU; Subkey: "Software\Classes\Gitero.Markdown"; ValueType: string; ValueData: "Markdown Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.Markdown"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Markdown Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.Markdown\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-markdown.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.Markdown\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\md_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-markdown.ico"
Root: HKCU; Subkey: "Software\Classes\.md\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Markdown"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.markdown\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Markdown"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.md"; ValueType: string; ValueData: "Gitero.Markdown"; Tasks: assoc_md
Root: HKCU; Subkey: "Software\Classes\.markdown"; ValueType: string; ValueData: "Gitero.Markdown"; Tasks: assoc_md

; TypeScript
Root: HKCU; Subkey: "Software\Classes\Gitero.TypeScript"; ValueType: string; ValueData: "TypeScript Source File"
Root: HKCU; Subkey: "Software\Classes\Gitero.TypeScript"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "TypeScript Source File"
Root: HKCU; Subkey: "Software\Classes\Gitero.TypeScript\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-typescript.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.TypeScript\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\ts_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-typescript.ico"
Root: HKCU; Subkey: "Software\Classes\tsx_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-typescript.ico"
Root: HKCU; Subkey: "Software\Classes\.ts\OpenWithProgids"; ValueType: string; ValueName: "Gitero.TypeScript"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.tsx\OpenWithProgids"; ValueType: string; ValueName: "Gitero.TypeScript"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.ts"; ValueType: string; ValueData: "Gitero.TypeScript"; Tasks: assoc_code
Root: HKCU; Subkey: "Software\Classes\.tsx"; ValueType: string; ValueData: "Gitero.TypeScript"; Tasks: assoc_code

; JavaScript
Root: HKCU; Subkey: "Software\Classes\Gitero.JavaScript"; ValueType: string; ValueData: "JavaScript Source File"
Root: HKCU; Subkey: "Software\Classes\Gitero.JavaScript"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "JavaScript Source File"
Root: HKCU; Subkey: "Software\Classes\Gitero.JavaScript\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-javascript.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.JavaScript\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\js_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-javascript.ico"
Root: HKCU; Subkey: "Software\Classes\jsx_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-javascript.ico"
Root: HKCU; Subkey: "Software\Classes\.js\OpenWithProgids"; ValueType: string; ValueName: "Gitero.JavaScript"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.jsx\OpenWithProgids"; ValueType: string; ValueName: "Gitero.JavaScript"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.js"; ValueType: string; ValueData: "Gitero.JavaScript"; Tasks: assoc_code
Root: HKCU; Subkey: "Software\Classes\.jsx"; ValueType: string; ValueData: "Gitero.JavaScript"; Tasks: assoc_code

; Python
Root: HKCU; Subkey: "Software\Classes\Gitero.Python"; ValueType: string; ValueData: "Python Script File"
Root: HKCU; Subkey: "Software\Classes\Gitero.Python"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Python Script File"
Root: HKCU; Subkey: "Software\Classes\Gitero.Python\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-python.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.Python\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\py_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-python.ico"
Root: HKCU; Subkey: "Software\Classes\.py\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Python"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.py"; ValueType: string; ValueData: "Gitero.Python"; Tasks: assoc_code

; HTML
Root: HKCU; Subkey: "Software\Classes\Gitero.HTML"; ValueType: string; ValueData: "HTML Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.HTML"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "HTML Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.HTML\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-html.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.HTML\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\html_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-html.ico"
Root: HKCU; Subkey: "Software\Classes\htm_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-html.ico"
Root: HKCU; Subkey: "Software\Classes\.html\OpenWithProgids"; ValueType: string; ValueName: "Gitero.HTML"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.htm\OpenWithProgids"; ValueType: string; ValueName: "Gitero.HTML"; ValueData: ""

; CSS
Root: HKCU; Subkey: "Software\Classes\Gitero.CSS"; ValueType: string; ValueData: "Cascading Style Sheet"
Root: HKCU; Subkey: "Software\Classes\Gitero.CSS"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Cascading Style Sheet"
Root: HKCU; Subkey: "Software\Classes\Gitero.CSS\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-css.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.CSS\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\css_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-css.ico"
Root: HKCU; Subkey: "Software\Classes\scss_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-css.ico"
Root: HKCU; Subkey: "Software\Classes\.css\OpenWithProgids"; ValueType: string; ValueName: "Gitero.CSS"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.scss\OpenWithProgids"; ValueType: string; ValueName: "Gitero.CSS"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.css"; ValueType: string; ValueData: "Gitero.CSS"; Tasks: assoc_code

; JSON
Root: HKCU; Subkey: "Software\Classes\Gitero.JSON"; ValueType: string; ValueData: "JSON Configuration File"
Root: HKCU; Subkey: "Software\Classes\Gitero.JSON"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "JSON Configuration File"
Root: HKCU; Subkey: "Software\Classes\Gitero.JSON\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-json.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.JSON\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\json_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-json.ico"
Root: HKCU; Subkey: "Software\Classes\.json\OpenWithProgids"; ValueType: string; ValueName: "Gitero.JSON"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.json"; ValueType: string; ValueData: "Gitero.JSON"; Tasks: assoc_code

; YAML
Root: HKCU; Subkey: "Software\Classes\Gitero.YAML"; ValueType: string; ValueData: "YAML Configuration File"
Root: HKCU; Subkey: "Software\Classes\Gitero.YAML"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "YAML Configuration File"
Root: HKCU; Subkey: "Software\Classes\Gitero.YAML\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-yaml.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.YAML\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\yaml_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-yaml.ico"
Root: HKCU; Subkey: "Software\Classes\yml_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-yaml.ico"
Root: HKCU; Subkey: "Software\Classes\.yaml\OpenWithProgids"; ValueType: string; ValueName: "Gitero.YAML"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.yml\OpenWithProgids"; ValueType: string; ValueName: "Gitero.YAML"; ValueData: ""

; Shell
Root: HKCU; Subkey: "Software\Classes\Gitero.Shell"; ValueType: string; ValueData: "Shell Script File"
Root: HKCU; Subkey: "Software\Classes\Gitero.Shell"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Shell Script File"
Root: HKCU; Subkey: "Software\Classes\Gitero.Shell\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-shell.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.Shell\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\sh_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-shell.ico"
Root: HKCU; Subkey: "Software\Classes\.sh\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Shell"; ValueData: ""

; Generic Code
Root: HKCU; Subkey: "Software\Classes\Gitero.Code"; ValueType: string; ValueData: "Source Code File"
Root: HKCU; Subkey: "Software\Classes\Gitero.Code"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Source Code File"
Root: HKCU; Subkey: "Software\Classes\Gitero.Code\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-code.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.Code\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\c_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-code.ico"
Root: HKCU; Subkey: "Software\Classes\cpp_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-code.ico"
Root: HKCU; Subkey: "Software\Classes\.c\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Code"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.cpp\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Code"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.rs\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Code"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.go\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Code"; ValueData: ""

; PHP
Root: HKCU; Subkey: "Software\Classes\Gitero.PHP"; ValueType: string; ValueData: "PHP Source File"
Root: HKCU; Subkey: "Software\Classes\Gitero.PHP"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "PHP Source File"
Root: HKCU; Subkey: "Software\Classes\Gitero.PHP\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-php.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.PHP\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\php_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-php.ico"
Root: HKCU; Subkey: "Software\Classes\.php\OpenWithProgids"; ValueType: string; ValueName: "Gitero.PHP"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.phtml\OpenWithProgids"; ValueType: string; ValueName: "Gitero.PHP"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.php"; ValueType: string; ValueData: "Gitero.PHP"; Tasks: assoc_code
Root: HKCU; Subkey: "Software\Classes\.phtml"; ValueType: string; ValueData: "Gitero.PHP"; Tasks: assoc_code

; Plain Text
Root: HKCU; Subkey: "Software\Classes\Gitero.Text"; ValueType: string; ValueData: "Plain Text Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.Text"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Plain Text Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.Text\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-text.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.Text\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\txtfile_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-text.ico"
Root: HKCU; Subkey: "Software\Classes\txt_auto_file\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document-text.ico"
Root: HKCU; Subkey: "Software\Classes\.txt\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Text"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.log\OpenWithProgids"; ValueType: string; ValueName: "Gitero.Text"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.txt"; ValueType: string; ValueData: "Gitero.Text"; Tasks: assoc_txt

; Default Document Fallback
Root: HKCU; Subkey: "Software\Classes\Gitero.Document"; ValueType: string; ValueData: "Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.Document"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Document"
Root: HKCU; Subkey: "Software\Classes\Gitero.Document\DefaultIcon"; ValueType: string; ValueData: "{app}\icons\file-types\document.ico"
Root: HKCU; Subkey: "Software\Classes\Gitero.Document\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

; 7. Windows Default Programs Registered Capabilities
Root: HKCU; Subkey: "Software\Gitero\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "Gitero IDE - Modern High-Performance Code & Markdown Editor"
Root: HKCU; Subkey: "Software\Gitero\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "{#MyAppName}"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".md"; ValueData: "Gitero.Markdown"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".markdown"; ValueData: "Gitero.Markdown"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".txt"; ValueData: "Gitero.Text"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".js"; ValueData: "Gitero.JavaScript"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".ts"; ValueData: "Gitero.TypeScript"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".py"; ValueData: "Gitero.Python"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".json"; ValueData: "Gitero.JSON"
Root: HKCU; Subkey: "Software\Gitero\Capabilities\FileAssociations"; ValueType: string; ValueName: ".php"; ValueData: "Gitero.PHP"
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "Gitero"; ValueData: "Software\Gitero\Capabilities"

; 8. Windows Startup for Explorer Ctrl+. Shortcut
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "GiteroExplorerHotkey"; ValueData: """{app}\bin\gitero_explorer_hotkey.exe"""; Flags: uninsdeletevalue; Tasks: explorer_hotkey

; 9. Microsoft WebView2 Window Transparency Environment Variable
Root: HKCU; Subkey: "Environment"; ValueType: string; ValueName: "WEBVIEW2_DEFAULT_BACKGROUND_COLOR"; ValueData: "00FFFFFF"; Flags: preservestringtype

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\bin\gitero_explorer_hotkey.exe"; Flags: nowait; Tasks: explorer_hotkey

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /T /IM gitero_explorer_hotkey.exe /IM glitero_explorer_hotkey.exe /IM Gitero.exe /IM gitero-win_x64.exe"; Flags: runhidden; RunOnceId: "KillGiteroProcesses"

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

procedure SHChangeNotify(wEventId: LongInt; uFlags: Cardinal; dwItem1, dwItem2: Cardinal);
  external 'SHChangeNotify@shell32.dll stdcall';

procedure KillHotkeyProcess();
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM gitero_explorer_hotkey.exe /IM glitero_explorer_hotkey.exe /IM Gitero.exe /IM gitero-win_x64.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(250);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    KillHotkeyProcess();
  end
  else if CurStep = ssPostInstall then
  begin
    RegisterPath();
    RegWriteStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'WEBVIEW2_DEFAULT_BACKGROUND_COLOR', '00FFFFFF');
    SHChangeNotify($08000000, 0, 0, 0);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    KillHotkeyProcess();
  end
  else if CurUninstallStep = usPostUninstall then
  begin
    UnregisterPath();
    SHChangeNotify($08000000, 0, 0, 0);
  end;
end;
