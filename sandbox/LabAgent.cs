// rootshell-Agent für die Windows-Sandbox (wird in der Sandbox per Add-Type kompiliert, C# 5).
// Lauscht auf einem TCP-Port. Jede Verbindung beginnt mit einer Kopfzeile:
//   "<token> SHELL <cols> <rows>\n"  → echte PowerShell in einer Pseudo-Konsole (ConPTY)
//        Client → Agent: Rahmen [Typ 1 Byte][Länge 4 Byte BE][Daten]  Typ 0 = Eingabe, Typ 1 = Größe (cols,rows je 2 Byte)
//        Agent → Client: rohe Terminalausgabe
//   "<token> EXEC\n<base64 UTF-16 Skript>\n" → Skript ausführen, Ausgabe + "\n__EXIT__=<code>\n"
//   "<token> PING\n" → "PONG\n"
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class LabAgent
{
    [StructLayout(LayoutKind.Sequential)] struct COORD { public short X; public short Y; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO
    {
        public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
        public int dwX; public int dwY; public int dwXSize; public int dwYSize;
        public int dwXCountChars; public int dwYCountChars; public int dwFillAttribute; public int dwFlags;
        public short wShowWindow; public short cbReserved2; public IntPtr lpReserved2;
        public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError;
    }
    [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX { public STARTUPINFO StartupInfo; public IntPtr lpAttributeList; }
    [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public int dwProcessId; public int dwThreadId; }

    [DllImport("kernel32.dll", SetLastError = true)] static extern int CreatePseudoConsole(COORD size, SafeFileHandle hInput, SafeFileHandle hOutput, uint dwFlags, out IntPtr phPC);
    [DllImport("kernel32.dll", SetLastError = true)] static extern int ResizePseudoConsole(IntPtr hPC, COORD size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern void ClosePseudoConsole(IntPtr hPC);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool CreatePipe(out SafeFileHandle hReadPipe, out SafeFileHandle hWritePipe, IntPtr lpPipeAttributes, int nSize);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool InitializeProcThreadAttributeList(IntPtr lpAttributeList, int dwAttributeCount, int dwFlags, ref IntPtr lpSize);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool UpdateProcThreadAttribute(IntPtr lpAttributeList, uint dwFlags, IntPtr attribute, IntPtr lpValue, IntPtr cbSize, IntPtr lpPreviousValue, IntPtr lpReturnSize);
    [DllImport("kernel32.dll", SetLastError = true)] static extern void DeleteProcThreadAttributeList(IntPtr lpAttributeList);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcessW(string lpApplicationName, StringBuilder lpCommandLine, IntPtr lpProcessAttributes, IntPtr lpThreadAttributes,
        bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFOEX lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr h);

    const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    static readonly IntPtr PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE = (IntPtr)0x00020016;

    static string token;
    public static string LastError = "";

    public static void Start(string bind, int port, string tok)
    {
        token = tok;
        TcpListener listener = new TcpListener(IPAddress.Parse(bind), port);
        listener.Start();
        Thread t = new Thread(delegate ()
        {
            while (true)
            {
                TcpClient c = listener.AcceptTcpClient();
                Thread h = new Thread(delegate () { Handle(c); });
                h.IsBackground = true; h.Start();
            }
        });
        t.IsBackground = true; t.Start();
    }

    static string ReadLine(Stream s)
    {
        StringBuilder sb = new StringBuilder();
        while (sb.Length < 1000000)
        {
            int b = s.ReadByte();
            if (b < 0 || b == '\n') break;
            if (b != '\r') sb.Append((char)b);
        }
        return sb.ToString();
    }

    static void Handle(TcpClient c)
    {
        try
        {
            c.NoDelay = true;
            NetworkStream ns = c.GetStream();
            string[] head = ReadLine(ns).Split(' ');
            if (head.Length < 2 || head[0] != token) { c.Close(); return; }
            if (head[1] == "PING") { Write(ns, "PONG\n"); }
            else if (head[1] == "EXEC") { Exec(ns, ReadLine(ns)); }
            else if (head[1] == "SHELL" && head.Length >= 4) { Shell(ns, short.Parse(head[2]), short.Parse(head[3])); }
        }
        catch (Exception e) { LastError = e.ToString(); }
        try { c.Close(); } catch { }
    }

    static void Write(Stream s, string text) { byte[] b = Encoding.UTF8.GetBytes(text); s.Write(b, 0, b.Length); s.Flush(); }

    static void Exec(NetworkStream ns, string b64)
    {
        // Als Datei ausführen (-File): Fehler kommen dann als lesbarer Text statt als CLIXML.
        string script = "$ProgressPreference = 'SilentlyContinue'\r\n[Console]::OutputEncoding = [Text.Encoding]::UTF8\r\n"
            + Encoding.Unicode.GetString(Convert.FromBase64String(b64));
        string file = Path.Combine(Path.GetTempPath(), "lab-" + Guid.NewGuid().ToString("N") + ".ps1");
        File.WriteAllText(file, script, new UTF8Encoding(true));
        ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + file + "\"");
        psi.UseShellExecute = false; psi.RedirectStandardOutput = true; psi.RedirectStandardError = true; psi.CreateNoWindow = true;
        psi.StandardOutputEncoding = Encoding.UTF8; psi.StandardErrorEncoding = Encoding.UTF8;
        Process p = Process.Start(psi);
        StringBuilder err = new StringBuilder();
        p.ErrorDataReceived += delegate (object o, DataReceivedEventArgs e) { if (e.Data != null) lock (err) err.AppendLine(e.Data); };
        p.BeginErrorReadLine();
        string output = p.StandardOutput.ReadToEnd();
        p.WaitForExit();
        try { File.Delete(file); } catch { }
        Write(ns, output + err.ToString() + "\n__EXIT__=" + p.ExitCode + "\n");
    }

    static void Shell(NetworkStream ns, short cols, short rows)
    {
        SafeFileHandle inRead, inWrite, outRead, outWrite;
        if (!CreatePipe(out inRead, out inWrite, IntPtr.Zero, 0) || !CreatePipe(out outRead, out outWrite, IntPtr.Zero, 0))
            throw new Exception("CreatePipe " + Marshal.GetLastWin32Error());
        COORD size; size.X = cols; size.Y = rows;
        IntPtr hPC;
        int hr = CreatePseudoConsole(size, inRead, outWrite, 0, out hPC);
        if (hr != 0) throw new Exception("CreatePseudoConsole 0x" + hr.ToString("X"));

        IntPtr attrSize = IntPtr.Zero;
        InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attrSize);
        IntPtr attrList = Marshal.AllocHGlobal(attrSize);
        if (!InitializeProcThreadAttributeList(attrList, 1, 0, ref attrSize)) throw new Exception("InitAttr " + Marshal.GetLastWin32Error());
        if (!UpdateProcThreadAttribute(attrList, 0, PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, hPC, (IntPtr)IntPtr.Size, IntPtr.Zero, IntPtr.Zero))
            throw new Exception("UpdateAttr " + Marshal.GetLastWin32Error());

        STARTUPINFOEX si = new STARTUPINFOEX();
        si.StartupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFOEX));
        si.lpAttributeList = attrList;
        // Wichtig: leere Standard-Handles erzwingen, sonst erbt PowerShell die (umgeleiteten) Handles
        // des Agenten und schreibt dorthin statt in die Pseudo-Konsole.
        si.StartupInfo.dwFlags = 0x00000100; // STARTF_USESTDHANDLES
        PROCESS_INFORMATION pi;
        string home = Environment.GetEnvironmentVariable("USERPROFILE");
        if (!CreateProcessW(null, new StringBuilder("powershell.exe -NoLogo"), IntPtr.Zero, IntPtr.Zero, false,
                EXTENDED_STARTUPINFO_PRESENT, IntPtr.Zero, home, ref si, out pi))
            throw new Exception("CreateProcess " + Marshal.GetLastWin32Error());
        // Die Enden, die jetzt der Pseudo-Konsole gehören, brauchen wir nicht mehr
        inRead.Dispose(); outWrite.Dispose();

        FileStream ptyOut = new FileStream(outRead, FileAccess.Read, 4096, false);
        FileStream ptyIn = new FileStream(inWrite, FileAccess.Write, 4096, false);
        bool done = false;
        Thread reader = new Thread(delegate ()
        {
            byte[] buf = new byte[8192];
            try
            {
                int n;
                while ((n = ptyOut.Read(buf, 0, buf.Length)) > 0) { ns.Write(buf, 0, n); ns.Flush(); }
            }
            catch { }
            done = true;
            try { ns.Close(); } catch { }
        });
        reader.IsBackground = true; reader.Start();

        try
        {
            byte[] hdr = new byte[5];
            while (!done)
            {
                if (!ReadFull(ns, hdr, 5)) break;
                int len = (hdr[1] << 24) | (hdr[2] << 16) | (hdr[3] << 8) | hdr[4];
                if (len < 0 || len > 1048576) break;
                byte[] data = new byte[len];
                if (!ReadFull(ns, data, len)) break;
                if (hdr[0] == 0) { ptyIn.Write(data, 0, len); ptyIn.Flush(); }
                else if (hdr[0] == 1 && len >= 4)
                {
                    COORD s2; s2.X = (short)((data[0] << 8) | data[1]); s2.Y = (short)((data[2] << 8) | data[3]);
                    ResizePseudoConsole(hPC, s2);
                }
            }
        }
        catch { }
        try { TerminateProcess(pi.hProcess, 0); } catch { }
        try { ClosePseudoConsole(hPC); } catch { }
        CloseHandle(pi.hProcess); CloseHandle(pi.hThread);
        DeleteProcThreadAttributeList(attrList); Marshal.FreeHGlobal(attrList);
        try { ptyIn.Dispose(); } catch { }
    }

    static bool ReadFull(Stream s, byte[] buf, int len)
    {
        int off = 0;
        while (off < len) { int n = s.Read(buf, off, len - off); if (n <= 0) return false; off += n; }
        return true;
    }
}
