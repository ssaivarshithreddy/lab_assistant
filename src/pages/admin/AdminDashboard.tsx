import { useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { LogOut, Users, Database, HardDrive, FileText, TrendingUp, Trash2, Eye, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { adminAuthService } from "@/services/adminAuthService";
import { adminStatsService, type SystemStats, type UserStats, type StorageBreakdown } from "@/services/adminStatsService";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log("[AdminDashboard] Starting data load...");
      const [sysStats, users, storage, allReports] = await Promise.all([
        adminStatsService.getSystemStats(),
        adminStatsService.getUserStats(),
        adminStatsService.getStorageBreakdown(),
        adminStatsService.getAllReports(),
      ]);

      console.log("[AdminDashboard] Data loaded successfully:", {
        sysStats,
        usersCount: users?.length,
        storageCount: storage?.length,
        reportsCount: allReports?.length,
      });

      setStats(sysStats);
      setUserStats(users);
      setStorageBreakdown(storage);
      setReports(allReports);
    } catch (error) {
      console.error("[AdminDashboard] Error loading data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Verify admin is authenticated
    if (!adminAuthService.isAuthenticated()) {
      console.log("Not authenticated, redirecting to login");
      navigate("/admin/login", { replace: true });
      return;
    }

    loadData();

    // Subscribe to real-time changes
    const unsubscribeReports = adminStatsService.subscribeToReports(() => {
      console.log("Reports updated, reloading data");
      loadData();
    });

    const unsubscribeProfiles = adminStatsService.subscribeToProfiles(() => {
      console.log("Profiles updated, reloading data");
      loadData();
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeReports();
      unsubscribeProfiles();
      adminStatsService.unsubscribeAll();
    };
  }, [navigate]);

  const handleLogout = () => {
    adminAuthService.logout();
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const success = await adminStatsService.deleteReport(reportId);
      if (success) {
        toast.success("Report deleted successfully");
        setReports(reports.filter((r) => r.id !== reportId));
      } else {
        toast.error("Failed to delete report");
      }
    } catch (error) {
      toast.error("Error deleting report");
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      const success = await adminStatsService.deleteUser(userId);
      if (success) {
        toast.success(`User ${userEmail} deleted successfully`);
        setUserStats(userStats.filter((u) => u.userId !== userId));
        setReports(reports.filter((r) => r.user_id !== userId));
      } else {
        toast.error("Failed to delete user");
      }
    } catch (error) {
      toast.error("Error deleting user");
    }
  };

  const chartData = userStats.slice(0, 10).map((user) => ({
    email: user.email.split("@")[0],
    reports: user.reportsCount,
    storage: Math.round(user.totalStorageBytes / 1024 / 1024),
  }));

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  const pieData = [
    { name: "Used", value: stats?.totalStorageMB || 0 },
    { name: "Available", value: Math.max(0, 1000 - (stats?.totalStorageMB || 0)) },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">System Management & Analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-slate-600">Loading dashboard data...</p>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
              <TabsTrigger value="database">Database</TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      +{stats?.usersCreatedToday || 0} today • +{stats?.usersCreatedThisMonth || 0} this month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                    <FileText className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalReports || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      +{stats?.reportsCreatedToday || 0} today • +{stats?.reportsCreatedThisMonth || 0} this month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
                    <HardDrive className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalStorageMB.toFixed(2)} MB</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Avg: {stats?.averageStoragePerUser || 0} KB per user
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg per User</CardTitle>
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.averageStoragePerUser || 0} KB</div>
                    <p className="text-xs text-slate-500 mt-1">Per user average</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Users by Reports & Storage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="email" angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="reports" fill="#3b82f6" name="Reports" />
                        <Bar yAxisId="right" dataKey="storage" fill="#8b5cf6" name="Storage (MB)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Storage Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value.toFixed(2)}MB`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${(value as number).toFixed(2)} MB`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* USERS TAB */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">Manage and monitor all user accounts</p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="w-full rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Email</th>
                          <th className="px-4 py-3 text-left font-semibold">Created</th>
                          <th className="px-4 py-3 text-left font-semibold">Reports</th>
                          <th className="px-4 py-3 text-left font-semibold">Storage</th>
                          <th className="px-4 py-3 text-left font-semibold">Last Activity</th>
                          <th className="px-4 py-3 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userStats.map((user) => (
                          <Fragment key={user.userId}>
                            <tr 
                              key={user.userId} 
                              className="border-b hover:bg-slate-50 cursor-pointer transition-colors duration-150"
                              onClick={() => setExpandedUserId(expandedUserId === user.userId ? null : user.userId)}
                            >
                              <td className="px-4 py-3 font-medium flex items-center gap-2">
                                <span className="text-slate-400 font-mono text-xs w-4">
                                  {expandedUserId === user.userId ? "▼" : "▶"}
                                </span>
                                {user.email}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{user.reportsCount}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                {(user.totalStorageBytes / 1024 / 1024).toFixed(2)} MB
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {user.lastActivityDate
                                  ? new Date(user.lastActivityDate).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td className="px-4 py-3">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                        Delete User
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete user <code className="bg-slate-100 px-2 py-1 rounded">{user.email}</code>? 
                                        This will also delete all their {user.reportsCount} report(s). This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteUser(user.userId, user.email);
                                        }}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </td>
                            </tr>
                            {expandedUserId === user.userId && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-4 py-2.5 border-b font-semibold text-xs text-slate-700">
                                      Reports Uploaded by {user.email}
                                    </div>
                                    {reports.filter((r) => r.user_id === user.userId || (user.userId === 'unknown_user' && !r.user_id)).length === 0 ? (
                                      <p className="p-4 text-xs text-slate-500 text-center">No reports uploaded by this user.</p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                          <thead className="bg-slate-50/70 border-b text-slate-600">
                                            <tr>
                                              <th className="px-4 py-2 font-semibold">Report ID</th>
                                              <th className="px-4 py-2 font-semibold">File Name</th>
                                              <th className="px-4 py-2 font-semibold">Created Date</th>
                                              <th className="px-4 py-2 font-semibold text-right">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {reports
                                              .filter((r) => r.user_id === user.userId || (user.userId === 'unknown_user' && !r.user_id))
                                              .map((report) => (
                                                <tr key={report.id} className="border-b hover:bg-slate-50/30">
                                                  <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{report.id}</td>
                                                  <td className="px-4 py-2 font-medium text-slate-700">{report.file_name}</td>
                                                  <td className="px-4 py-2 text-slate-600">
                                                    {new Date(report.created_at).toLocaleDateString()}
                                                  </td>
                                                  <td className="px-4 py-2 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 hover:bg-slate-100"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          navigator.clipboard.writeText(report.id);
                                                          toast.success("Report ID copied");
                                                        }}
                                                      >
                                                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                                                      </Button>
                                                      <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={(e) => e.stopPropagation()}
                                                          >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                          </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                          <AlertDialogHeader>
                                                            <AlertDialogTitle className="flex items-center gap-2">
                                                              <AlertTriangle className="w-5 h-5 text-red-600" />
                                                              Delete Report
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                              Are you sure you want to delete report <code className="bg-slate-100 px-2 py-1 rounded text-slate-800">{report.file_name}</code>? This action cannot be undone.
                                                            </AlertDialogDescription>
                                                          </AlertDialogHeader>
                                                          <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteReport(report.id);
                                                              }}
                                                              className="bg-red-600 hover:bg-red-700"
                                                            >
                                                              Delete
                                                            </AlertDialogAction>
                                                          </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                      </AlertDialog>
                                                    </div>
                                                  </td>
                                                </tr>
                                              ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STORAGE TAB */}
            <TabsContent value="storage">
              <Card>
                <CardHeader>
                  <CardTitle>Storage Breakdown</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">Detailed per-user storage analysis</p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="w-full rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Email</th>
                          <th className="px-4 py-3 text-left font-semibold">Storage Used</th>
                          <th className="px-4 py-3 text-left font-semibold">Reports</th>
                          <th className="px-4 py-3 text-left font-semibold">Avg Report Size</th>
                          <th className="px-4 py-3 text-left font-semibold">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storageBreakdown.map((item) => {
                          const percentage =
                            stats?.totalStorageMB && stats.totalStorageMB > 0
                              ? ((item.storageMB / stats.totalStorageMB) * 100).toFixed(2)
                              : "0.00";
                          return (
                            <tr key={item.userId} className="border-b hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium">{item.email}</td>
                              <td className="px-4 py-3">
                                <Badge>{item.storageMB.toFixed(2)} MB</Badge>
                              </td>
                              <td className="px-4 py-3">{item.reportCount}</td>
                              <td className="px-4 py-3">{item.averageReportSize} KB</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-500 h-2 rounded-full"
                                      style={{ width: `${Math.min(100, parseFloat(percentage))}%` }}
                                    />
                                  </div>
                                  <span>{percentage}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* DATABASE TAB */}
            <TabsContent value="database">
              <Card>
                <CardHeader>
                  <CardTitle>Database Management</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">Manage all reports in the system</p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="w-full rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Report ID</th>
                          <th className="px-4 py-3 text-left font-semibold">File Name</th>
                          <th className="px-4 py-3 text-left font-semibold">User Email</th>
                          <th className="px-4 py-3 text-left font-semibold">Created</th>
                          <th className="px-4 py-3 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((report) => {
                          const user = userStats.find((u) => u.userId === report.user_id);
                          return (
                            <tr key={report.id} className="border-b hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono text-xs">{report.id.slice(0, 12)}...</td>
                              <td className="px-4 py-3">{report.file_name}</td>
                              <td className="px-4 py-3">{user?.email || "Unknown"}</td>
                              <td className="px-4 py-3">
                                {new Date(report.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(report.id);
                                      toast.success("Report ID copied");
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                          <AlertTriangle className="w-5 h-5 text-red-600" />
                                          Delete Report
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this report? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteReport(report.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
