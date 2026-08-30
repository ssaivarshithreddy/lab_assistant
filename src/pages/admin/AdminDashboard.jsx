import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  HardDrive,
  FileText,
  MessageSquare,
  TrendingUp,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Database,
  Terminal,
  Layers,
  Download,
  Play,
  RotateCw,
  Code,
  CheckCircle2,
  FileCode,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/AuthProvider";
import { adminStatsService } from "@/services/adminStatsService";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const COLORS = ["#6366f1", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899"];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [userStats, setUserStats] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("telemetry");
  const [searchQuery, setSearchQuery] = useState("");

  // DB Inspector State
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("reports");
  const [tableData, setTableData] = useState({ total_rows: 0, rows: [] });
  const [tableLoading, setTableLoading] = useState(false);

  // SQL Console State
  const [sqlInput, setSqlInput] = useState("SELECT * FROM reports ORDER BY created_at DESC LIMIT 10;");
  const [sqlResult, setSqlResult] = useState(null);
  const [sqlBusy, setSqlBusy] = useState(false);

  // MinIO Explorer State
  const [minioData, setMinioData] = useState({ bucket_name: "labsense-reports", total_objects: 0, objects: [] });
  const [minioLoading, setMinioLoading] = useState(false);
  const [previewObj, setPreviewObj] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sysStats, uStats, allReports, tables] = await Promise.all([
        adminStatsService.getSystemStats(),
        adminStatsService.getUserStats(),
        adminStatsService.getAllReports(),
        adminStatsService.getDbTables(),
      ]);

      setStats(sysStats);
      setUserStats(uStats);
      setReports(allReports);
      setDbTables(tables || []);
    } catch (error) {
      console.error("Error loading admin data:", error);
      toast.error("Failed to load admin telemetry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch Table Rows when selectedTable changes
  useEffect(() => {
    if (!selectedTable) return;
    (async () => {
      setTableLoading(true);
      const data = await adminStatsService.getDbTableRows(selectedTable, 50, 0);
      setTableData(data);
      setTableLoading(false);
    })();
  }, [selectedTable]);

  // Fetch MinIO Objects when minio_explorer tab active
  useEffect(() => {
    if (activeTab !== "minio_explorer") return;
    (async () => {
      setMinioLoading(true);
      const data = await adminStatsService.getMinioObjects();
      setMinioData(data);
      setMinioLoading(false);
    })();
  }, [activeTab]);

  const handleLogout = async () => {
    logout();
    toast.success("Admin logged out.");
    navigate("/admin/login", { replace: true });
  };

  const handleExecuteSql = async () => {
    if (!sqlInput.trim() || sqlBusy) return;
    setSqlBusy(true);
    try {
      const result = await adminStatsService.executeSqlQuery(sqlInput.trim());
      setSqlResult(result);
      toast.success(`Executed ${result.command} query in ${result.durationMs}ms`);
    } catch (err) {
      toast.error(`SQL Error: ${err.message}`);
      setSqlResult({ error: err.message });
    } finally {
      setSqlBusy(false);
    }
  };

  const handleReindexReport = async (reportId) => {
    try {
      const res = await adminStatsService.reindexReportChunks(reportId);
      toast.success(res.message || "Re-indexed RAG chunks.");
    } catch (err) {
      toast.error("Failed to re-index report.");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const success = await adminStatsService.deleteUser(userId);
      if (success) {
        toast.success("User account deleted successfully");
        setUserStats((prev) => prev.filter((u) => u.userId !== userId));
      } else {
        toast.error("Failed to delete user");
      }
    } catch (error) {
      toast.error("Error deleting user");
    }
  };

  const handleToggleRole = async (userId, currentRole, userEmail) => {
    const targetRole = currentRole === "admin" ? "user" : "admin";
    try {
      const result = await adminStatsService.updateUserRole(userId, targetRole);
      if (result.success) {
        toast.success(`Updated role for ${userEmail} to ${targetRole}`);
        setUserStats((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, role: targetRole } : u))
        );
        if (userId === user?.id && result.res?.user && result.res?.token) {
          updateUser(result.res.user, result.res.token);
        }
      } else {
        toast.error(result.error || "Failed to update user role");
      }
    } catch (error) {
      toast.error("Error updating user role");
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      const success = await adminStatsService.deleteReport(reportId);
      if (success) {
        toast.success("Report deleted successfully");
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        setMinioData((prev) => ({
          ...prev,
          total_objects: Math.max(0, prev.total_objects - 1),
          objects: prev.objects.filter((o) => o.report_id !== reportId),
        }));
      } else {
        toast.error("Failed to delete report");
      }
    } catch (error) {
      toast.error("Error deleting report");
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return userStats;
    const q = searchQuery.toLowerCase();
    return userStats.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
    );
  }, [userStats, searchQuery]);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) =>
        r.file_name.toLowerCase().includes(q) ||
        (r.user_email && r.user_email.toLowerCase().includes(q))
    );
  }, [reports, searchQuery]);

  const chartData = useMemo(() => {
    return userStats.slice(0, 8).map((userItem) => ({
      name: userItem.fullName || userItem.email.split("@")[0],
      reports: userItem.reportsCount,
      storageMB: Math.round((userItem.totalStorageBytes / (1024 * 1024)) * 100) / 100,
    }));
  }, [userStats]);

  const pieData = useMemo(() => {
    const usedMB = stats?.totalStorageMB || 0;
    return [
      { name: "Used Storage", value: usedMB > 0 ? usedMB : 0.1 },
      { name: "Available (Free)", value: Math.max(0, 1024 - usedMB) },
    ];
  }, [stats]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      {/* Freud UI Glassmorphic Header */}
      <header className="sticky top-0 z-40 freud-glass border-b border-border shadow-md px-4 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 text-white font-bold shadow-lg freud-glow-indigo">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-foreground tracking-tight">LabSense Data & Storage Suite</h1>
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px] uppercase font-bold tracking-wider">
                Database & MinIO Explorer
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium">PostgreSQL Inspector • MinIO Object Explorer • Raw SQL Console</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
              setTheme(nextTheme);
              toast.success(`Theme mode: ${nextTheme.toUpperCase()}`);
            }}
            className="rounded-2xl border-border bg-card text-foreground hover:bg-muted h-9 w-9"
            title={`Current Theme: ${(theme || "system").toUpperCase()}. Click to toggle Light / Dark / System Auto Mode.`}
          >
            {theme === "light" && <Sun className="h-4 w-4 text-amber-500" />}
            {theme === "dark" && <Moon className="h-4 w-4 text-indigo-400" />}
            {theme === "system" && <Monitor className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="border-border bg-card text-foreground hover:bg-muted text-xs rounded-xl"
          >
            Back to App
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-border bg-card text-foreground hover:bg-muted text-xs rounded-xl"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border p-1.5 rounded-2xl flex flex-wrap gap-1 shadow-sm">
            <TabsTrigger value="telemetry" className="text-xs rounded-xl font-bold px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-1.5 inline-block" /> Telemetry Overview
            </TabsTrigger>
            <TabsTrigger value="db_inspector" className="text-xs rounded-xl font-bold px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Database className="h-4 w-4 mr-1.5 inline-block" /> PostgreSQL Inspector
            </TabsTrigger>
            <TabsTrigger value="sql_console" className="text-xs rounded-xl font-bold px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Terminal className="h-4 w-4 mr-1.5 inline-block" /> SQL Query Console
            </TabsTrigger>
            <TabsTrigger value="minio_explorer" className="text-xs rounded-xl font-bold px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <HardDrive className="h-4 w-4 mr-1.5 inline-block" /> MinIO Storage Explorer
            </TabsTrigger>
            <TabsTrigger value="access_control" className="text-xs rounded-xl font-bold px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-1.5 inline-block" /> Users & Roles ({userStats.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TELEMETRY OVERVIEW */}
          <TabsContent value="telemetry" className="space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-80">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">Loading system metrics...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="freud-card border-border shadow-lg p-5">
                    <CardContent className="p-0 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registered Users</p>
                        <h3 className="text-3xl font-extrabold text-foreground mt-1">{stats?.totalUsers ?? 0}</h3>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                          <TrendingUp className="h-3 w-3" /> Active Postgres Accounts
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Users className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="freud-card border-border shadow-lg p-5">
                    <CardContent className="p-0 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lab Reports</p>
                        <h3 className="text-3xl font-extrabold text-foreground mt-1">{stats?.totalReports ?? 0}</h3>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                          <ArrowUpRight className="h-3 w-3" /> Processed & MinIO Stored
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <FileText className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="freud-card border-border shadow-lg p-5">
                    <CardContent className="p-0 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI Chat Messages</p>
                        <h3 className="text-3xl font-extrabold text-foreground mt-1">{stats?.totalMessages ?? 0}</h3>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-1">
                          <MessageSquare className="h-3 w-3" /> Freud AI History
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <MessageSquare className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="freud-card border-border shadow-lg p-5">
                    <CardContent className="p-0 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Storage Occupied</p>
                        <h3 className="text-3xl font-extrabold text-foreground mt-1">{stats?.totalStorageMB ?? 0} MB</h3>
                        <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1">
                          MinIO & Disk Objects
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <HardDrive className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 freud-card border-border p-6">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="text-base font-bold text-foreground">User Report Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-64 w-full">
                        {chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "1rem", color: "hsl(var(--foreground))" }} />
                              <Bar dataKey="reports" fill="#6366f1" radius={[6, 6, 0, 0]} name="Reports Uploaded" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No data available.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="freud-card border-border p-6">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="text-base font-bold text-foreground">MinIO Storage Usage</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col items-center justify-center">
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "1rem", color: "hsl(var(--foreground))" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold mt-2">
                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                          <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Used ({stats?.totalStorageMB || 0} MB)
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Free
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* TAB 2: POSTGRESQL TABLE INSPECTOR */}
          <TabsContent value="db_inspector" className="space-y-6">
            <Card className="freud-card border-border p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-500" /> PostgreSQL Table Inspector
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Select a table to view column definitions and raw database records.</p>
                </div>
                {/* Table Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {dbTables.map((t) => (
                    <Button
                      key={t.table_name}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTable(t.table_name)}
                      className={cn(
                        "rounded-xl text-xs font-bold transition-all border",
                        selectedTable === t.table_name
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md freud-glow-indigo"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      {t.table_name} ({t.row_count})
                    </Button>
                  ))}
                </div>
              </div>

              {/* Table Records Grid */}
              {tableLoading ? (
                <div className="flex items-center justify-center py-12 text-xs font-semibold text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-500" /> Fetching raw table records...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>Showing top {tableData.rows?.length || 0} of {tableData.total_rows || 0} rows in <code className="text-indigo-600 dark:text-indigo-400">{selectedTable}</code></span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full text-left text-xs text-foreground">
                      <thead className="bg-muted/80 text-muted-foreground uppercase text-[11px] font-bold">
                        <tr>
                          {tableData.rows?.[0] && Object.keys(tableData.rows[0]).map((col) => (
                            <th key={col} className="p-3 whitespace-nowrap">{col}</th>
                          ))}
                          {selectedTable === "reports" && <th className="p-3 text-right whitespace-nowrap">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card/40 font-mono text-[11px]">
                        {tableData.rows?.length > 0 ? (
                          tableData.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-muted/50 transition-colors">
                              {Object.entries(row).map(([k, val]) => (
                                <td key={k} className="p-3 max-w-[220px] truncate">
                                  {typeof val === "object" && val !== null ? (
                                    <span className="text-indigo-600 dark:text-indigo-300 font-sans font-semibold text-[11px]" title={JSON.stringify(val)}>
                                      JSON object ({Object.keys(val).length} keys)
                                    </span>
                                  ) : (
                                    String(val ?? "NULL")
                                  )}
                                </td>
                              ))}
                              {selectedTable === "reports" && (
                                <td className="p-3 text-right whitespace-nowrap font-sans">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReindexReport(row.id)}
                                    className="h-7 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                                    title="Re-index RAG Chunks"
                                  >
                                    <RotateCw className="h-3 w-3 mr-1" /> Re-index RAG
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10} className="p-6 text-center text-xs text-muted-foreground">No records found in table.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 3: SQL QUERY CONSOLE */}
          <TabsContent value="sql_console" className="space-y-6">
            <Card className="freud-card border-border p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-indigo-500" /> Interactive PostgreSQL SQL Console
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Run SQL queries against the local PostgreSQL database.</p>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                  rows={4}
                  className="font-mono text-xs bg-muted/60 border-border text-foreground rounded-2xl p-4 focus-visible:ring-indigo-500"
                  placeholder="Enter SQL query..."
                />
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => setSqlInput("SELECT * FROM users ORDER BY created_at DESC;")} className="text-[11px] h-7 rounded-lg">users</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSqlInput("SELECT * FROM reports ORDER BY created_at DESC;")} className="text-[11px] h-7 rounded-lg">reports</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSqlInput("SELECT * FROM report_chunks LIMIT 10;")} className="text-[11px] h-7 rounded-lg">report_chunks</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSqlInput("SELECT * FROM chat_messages LIMIT 10;")} className="text-[11px] h-7 rounded-lg">chat_messages</Button>
                  </div>
                  <Button
                    onClick={handleExecuteSql}
                    disabled={sqlBusy || !sqlInput.trim()}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs px-5 shadow-md freud-glow-indigo"
                  >
                    {sqlBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
                    Execute Query
                  </Button>
                </div>
              </div>

              {/* SQL Result Output */}
              {sqlResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground border-t border-border pt-3">
                    <span>Command: <code className="text-indigo-600 dark:text-indigo-400">{sqlResult.command || "QUERY"}</code> ({sqlResult.rowCount ?? 0} rows)</span>
                    {sqlResult.durationMs != null && <span>Execution Time: {sqlResult.durationMs}ms</span>}
                  </div>

                  {sqlResult.error ? (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-mono text-xs">
                      ⚠️ {sqlResult.error}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-border">
                      <table className="w-full text-left text-xs text-foreground font-mono">
                        <thead className="bg-muted/80 text-muted-foreground uppercase text-[11px] font-bold">
                          <tr>
                            {sqlResult.columns?.map((col) => (
                              <th key={col} className="p-3 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card/40 text-[11px]">
                          {sqlResult.rows?.length > 0 ? (
                            sqlResult.rows.map((r, idx) => (
                              <tr key={idx} className="hover:bg-muted/50 transition-colors">
                                {sqlResult.columns?.map((c) => (
                                  <td key={c} className="p-3 max-w-[240px] truncate">
                                    {typeof r[c] === "object" && r[c] !== null ? JSON.stringify(r[c]) : String(r[c] ?? "NULL")}
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={10} className="p-4 text-center text-xs text-muted-foreground font-sans">No rows returned.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 4: MINIO STORAGE EXPLORER */}
          <TabsContent value="minio_explorer" className="space-y-6">
            <Card className="freud-card border-border p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-indigo-500" /> MinIO & Local Storage Explorer
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Bucket: <code className="text-indigo-600 dark:text-indigo-400 font-bold">{minioData.bucket_name}</code> ({minioData.total_objects} stored objects)</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setMinioLoading(true);
                    const data = await adminStatsService.getMinioObjects();
                    setMinioData(data);
                    setMinioLoading(false);
                    toast.success("Storage bucket refreshed.");
                  }}
                  disabled={minioLoading}
                  className="rounded-xl text-xs font-bold border-border bg-card"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", minioLoading ? "animate-spin" : "")} /> Refresh Bucket
                </Button>
              </div>

              {minioLoading ? (
                <div className="flex items-center justify-center py-12 text-xs font-semibold text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-500" /> Querying MinIO object bucket...
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-left text-xs text-foreground">
                    <thead className="bg-muted/80 text-muted-foreground uppercase text-[11px] font-bold">
                      <tr>
                        <th className="p-3.5">File Name</th>
                        <th className="p-3.5">Owner User</th>
                        <th className="p-3.5">Storage Key / Location</th>
                        <th className="p-3.5">Created Date</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card/40">
                      {minioData.objects?.length > 0 ? (
                        minioData.objects.map((obj) => (
                          <tr key={obj.report_id} className="hover:bg-muted/50 transition-colors">
                            <td className="p-3.5 font-bold text-foreground flex items-center gap-2.5">
                              <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                              <span className="truncate max-w-[200px]">{obj.file_name}</span>
                            </td>
                            <td className="p-3.5 text-muted-foreground font-medium">{obj.owner_email}</td>
                            <td className="p-3.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 truncate max-w-[220px]">
                              {obj.object_key}
                            </td>
                            <td className="p-3.5 text-muted-foreground font-medium">{new Date(obj.created_at).toLocaleDateString()}</td>
                            <td className="p-3.5 text-right flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPreviewObj(obj)}
                                className="h-8 w-8 text-indigo-500 hover:bg-indigo-500/10 rounded-xl"
                                title="Preview File"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <a
                                href={apiClient.getReportFileUrl(obj.report_id)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                                title="Download File Stream"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-xl">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card border-border text-foreground rounded-3xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-foreground">Delete MinIO Object?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                      This will remove <strong className="text-foreground">{obj.file_name}</strong> from PostgreSQL and MinIO storage.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-muted text-muted-foreground rounded-xl">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteReport(obj.report_id)} className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl">
                                      Delete File
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">No object files found in storage.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 5: USER DIRECTORY & ACCESS CONTROL */}
          <TabsContent value="access_control" className="space-y-6">
            <Card className="freud-card border-border p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Registered User Directory & Roles</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Toggle administrative access or manage accounts.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="pl-9 bg-muted/50 border-border text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500 rounded-2xl"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-muted/80 text-muted-foreground uppercase text-[11px] font-bold">
                    <tr>
                      <th className="p-3.5">User Details</th>
                      <th className="p-3.5">Contact Phone</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Joined Date</th>
                      <th className="p-3.5">Uploaded Reports</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card/40">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <tr key={u.userId} className="hover:bg-muted/50 transition-colors">
                          <td className="p-3.5 font-bold text-foreground flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold text-xs">
                              {(u.fullName || u.email).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm">{u.fullName || "User"}</div>
                              <div className="text-[11px] text-muted-foreground font-normal">{u.email}</div>
                            </div>
                          </td>
                          <td className="p-3.5 text-muted-foreground font-medium">{u.phoneNumber || "N/A"}</td>
                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u.userId, u.role, u.email)}
                              title={`Click to switch role to ${u.role === 'admin' ? 'user' : 'admin'}`}
                              className="focus:outline-none group"
                            >
                              <Badge
                                variant={u.role === "admin" ? "default" : "secondary"}
                                className="capitalize text-[11px] font-bold cursor-pointer group-hover:ring-1 group-hover:ring-indigo-500 transition-all flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
                              >
                                {u.role}
                                <span className="text-[9px] opacity-70">⇅</span>
                              </Badge>
                            </button>
                          </td>
                          <td className="p-3.5 text-muted-foreground font-medium">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400">{u.reportsCount}</td>
                          <td className="p-3.5 text-right">
                            {u.role !== "admin" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-xl">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card border-border text-foreground rounded-3xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-foreground">Delete User Account?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                      Are you sure you want to delete user <strong className="text-foreground">{u.email}</strong>?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-muted text-muted-foreground rounded-xl">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(u.userId)} className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl">
                                      Delete User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* File Preview Modal */}
      {previewObj && (
        <Dialog open={!!previewObj} onOpenChange={() => setPreviewObj(null)}>
          <DialogContent className="max-w-3xl bg-card border-border text-foreground rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-500" /> Preview File: {previewObj.file_name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Owner: {previewObj.owner_email} • Uploaded: {new Date(previewObj.created_at).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex flex-col items-center justify-center p-4 bg-muted/40 rounded-2xl min-h-[300px]">
              {previewObj.file_name.endsWith(".pdf") ? (
                <iframe
                  src={apiClient.getReportFileUrl(previewObj.report_id)}
                  className="w-full h-[450px] rounded-xl border border-border"
                  title="PDF Preview"
                />
              ) : previewObj.file_name.match(/\.(png|jpg|jpeg)$/i) ? (
                <img
                  src={apiClient.getReportFileUrl(previewObj.report_id)}
                  alt="Preview"
                  className="max-h-[450px] rounded-xl object-contain shadow-md"
                />
              ) : (
                <div className="text-center space-y-2">
                  <FileText className="h-12 w-12 text-indigo-500 mx-auto" />
                  <p className="text-xs text-muted-foreground font-medium">Binary document file ({previewObj.file_name})</p>
                  <Button asChild size="sm" className="bg-indigo-600 text-white font-bold rounded-xl mt-2">
                    <a href={apiClient.getReportFileUrl(previewObj.report_id)} target="_blank" rel="noreferrer">
                      Download File
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
