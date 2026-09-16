using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace GiteroExplorerHotkey
{
    static class Program
    {
        private const string MUTEX_NAME = "Gitero_Explorer_Hotkey_Single_Instance_Mutex_v1";

        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int VK_CONTROL = 0x11;
        private const int VK_MENU = 0x12; // Alt
        private const int VK_SHIFT = 0x10;
        private const int VK_LWIN = 0x5B;
        private const int VK_RWIN = 0x5C;
        private const int VK_OEM_PERIOD = 0xBE; // '.' key

        private static LowLevelKeyboardProc _proc = HookCallback;
        private static IntPtr _hookId = IntPtr.Zero;
        private static Mutex _mutex = null;

        [STAThread]
        static void Main()
        {
            bool createdNew;
            _mutex = new Mutex(true, MUTEX_NAME, out createdNew);

            if (!createdNew)
            {
                // Another instance is already running in background, exit silently
                return;
            }

            _hookId = SetHook(_proc);

            Application.ApplicationExit += (s, e) =>
            {
                UnhookWindowsHookEx(_hookId);
                if (_mutex != null)
                {
                    _mutex.ReleaseMutex();
                    _mutex.Close();
                }
            };

            Application.Run();
        }

        private static IntPtr SetHook(LowLevelKeyboardProc proc)
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
            }
        }

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN))
            {
                int vkCode = Marshal.ReadInt32(lParam);

                if (vkCode == VK_OEM_PERIOD)
                {
                    bool ctrlDown = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
                    bool altDown = (GetKeyState(VK_MENU) & 0x8000) != 0;
                    bool shiftDown = (GetKeyState(VK_SHIFT) & 0x8000) != 0;
                    bool winDown = (GetKeyState(VK_LWIN) & 0x8000) != 0 || (GetKeyState(VK_RWIN) & 0x8000) != 0;

                    // Trigger only on pure Ctrl + . (no Alt, Shift, or Win key)
                    if (ctrlDown && !altDown && !shiftDown && !winDown)
                    {
                        IntPtr fgHwnd = GetForegroundWindow();
                        if (fgHwnd != IntPtr.Zero)
                        {
                            string className = GetWindowClassName(fgHwnd);

                            // Check if foreground window is Windows File Explorer or Desktop
                            if (IsExplorerClass(className))
                            {
                                // Dispatch to background thread to prevent hook latency
                                ThreadPool.QueueUserWorkItem(state =>
                                {
                                    try
                                    {
                                        HandleExplorerHotkey(fgHwnd, className);
                                    }
                                    catch
                                    {
                                        // Silent error handling
                                    }
                                });

                                // Swallow keystroke so Explorer doesn't beep or pass it on
                                return (IntPtr)1;
                            }
                        }
                    }
                }
            }

            // Immediately pass through all other key events untouched to the OS
            return CallNextHookEx(_hookId, nCode, wParam, lParam);
        }

        private static bool IsExplorerClass(string className)
        {
            if (string.IsNullOrEmpty(className)) return false;
            return className.Equals("CabinetWClass", StringComparison.OrdinalIgnoreCase)
                || className.Equals("ExploreWClass", StringComparison.OrdinalIgnoreCase)
                || className.Equals("Progman", StringComparison.OrdinalIgnoreCase)
                || className.Equals("WorkerW", StringComparison.OrdinalIgnoreCase);
        }

        private static void HandleExplorerHotkey(IntPtr fgHwnd, string className)
        {
            string targetFolder = ResolveTargetDirectory(fgHwnd, className);

            if (string.IsNullOrEmpty(targetFolder) || !Directory.Exists(targetFolder))
            {
                // Fallback to Desktop or User profile if directory resolution fails
                if (className.Equals("Progman", StringComparison.OrdinalIgnoreCase) ||
                    className.Equals("WorkerW", StringComparison.OrdinalIgnoreCase))
                {
                    targetFolder = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                }
                else
                {
                    targetFolder = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                }
            }

            LaunchGitero(targetFolder);
        }

        private static string ResolveTargetDirectory(IntPtr fgHwnd, string className)
        {
            // Case 1: Windows Desktop
            if (className.Equals("Progman", StringComparison.OrdinalIgnoreCase) ||
                className.Equals("WorkerW", StringComparison.OrdinalIgnoreCase))
            {
                return Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            }

            // Case 2: Windows File Explorer (CabinetWClass / ExploreWClass)
            try
            {
                Type shellType = Type.GetTypeFromProgID("Shell.Application");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic windows = shell.Windows();

                    var matchingPaths = new System.Collections.Generic.List<string>();
                    var matchingTitles = new System.Collections.Generic.List<string>();

                    string activeWindowTitle = GetWindowTitle(fgHwnd);

                    foreach (dynamic item in (IEnumerable)windows)
                    {
                        try
                        {
                            long hwnd = (long)item.HWND;
                            if (hwnd == (long)fgHwnd)
                            {
                                string path = "";
                                try
                                {
                                    path = item.Document.Folder.Self.Path;
                                }
                                catch {}

                                if (!string.IsNullOrEmpty(path) && Directory.Exists(path))
                                {
                                    matchingPaths.Add(path);
                                    try
                                    {
                                        matchingTitles.Add(item.LocationName as string ?? "");
                                    }
                                    catch
                                    {
                                        matchingTitles.Add("");
                                    }
                                }
                            }
                        }
                        catch {}
                    }

                    // If only 1 tab / window matches this HWND, we have the exact path
                    if (matchingPaths.Count == 1)
                    {
                        return matchingPaths[0];
                    }

                    // In Windows 11 with multiple tabs, match by active window title
                    if (matchingPaths.Count > 1 && !string.IsNullOrEmpty(activeWindowTitle))
                    {
                        for (int i = 0; i < matchingPaths.Count; i++)
                        {
                            string title = matchingTitles[i];
                            if (!string.IsNullOrEmpty(title) && activeWindowTitle.IndexOf(title, StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                return matchingPaths[i];
                            }
                        }

                        // Default to the first tab if title match wasn't definitive
                        return matchingPaths[0];
                    }
                }
            }
            catch {}

            return null;
        }

        private static void LaunchGitero(string targetPath)
        {
            string giteroExe = FindGiteroExecutable();
            if (string.IsNullOrEmpty(giteroExe) || !File.Exists(giteroExe))
            {
                return;
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = giteroExe,
                    Arguments = "\"" + targetPath + "\"",
                    UseShellExecute = true,
                    WorkingDirectory = targetPath
                };
                Process.Start(psi);
            }
            catch {}
        }

        private static string FindGiteroExecutable()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // 1. In installed directory: beside bin/
            string cand1 = Path.GetFullPath(Path.Combine(baseDir, "..\\Gitero.exe"));
            if (File.Exists(cand1)) return cand1;

            // 2. In baseDir directly
            string cand2 = Path.Combine(baseDir, "Gitero.exe");
            if (File.Exists(cand2)) return cand2;

            // 3. User installation in LocalAppData
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string cand3 = Path.Combine(localAppData, "Programs\\Gitero IDE\\Gitero.exe");
            if (File.Exists(cand3)) return cand3;

            // 4. Development build artifact in dist/gitero/gitero-win_x64.exe
            string cand4 = Path.GetFullPath(Path.Combine(baseDir, "..\\dist\\gitero\\gitero-win_x64.exe"));
            if (File.Exists(cand4)) return cand4;

            // 5. In repository root Gitero.exe
            string cand5 = Path.GetFullPath(Path.Combine(baseDir, "..\\..\\dist\\gitero\\gitero-win_x64.exe"));
            if (File.Exists(cand5)) return cand5;

            return null;
        }

        private static string GetWindowClassName(IntPtr hWnd)
        {
            StringBuilder sb = new StringBuilder(256);
            GetClassName(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        private static string GetWindowTitle(IntPtr hWnd)
        {
            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        // P/Invoke Win32 API
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern short GetKeyState(int nVirtKey);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    }
}
