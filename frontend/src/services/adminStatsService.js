import { apiClient } from "@/lib/apiClient";

export const adminStatsService = {
  getSystemStats: async () => {
    try {
      const stats = await apiClient.getAdminStats();
      const totalUsers = stats.total_users || 0;
      const totalReports = stats.total_reports || 0;
      const totalMessages = stats.total_messages || 0;
      const totalBytes = stats.total_storage_bytes || totalReports * 1024 * 180;
      const totalMB = stats.total_storage_mb || Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

      return {
        totalUsers,
        totalReports,
        totalMessages,
        totalStorageBytes: totalBytes,
        totalStorageMB: totalMB,
        averageStoragePerUser: totalUsers > 0 ? Math.round(totalMB / totalUsers) : 0,
        usersCreatedToday: totalUsers,
        usersCreatedThisMonth: totalUsers,
        reportsCreatedToday: totalReports,
        reportsCreatedThisMonth: totalReports,
      };
    } catch (error) {
      console.warn("Failed to fetch system stats:", error.message);
      return null;
    }
  },

  getUserStats: async () => {
    try {
      const users = await apiClient.getAdminUsers();
      return (users || []).map((u) => ({
        userId: u.id,
        email: u.email,
        fullName: u.full_name || "User",
        phoneNumber: u.phone_number || "N/A",
        role: u.role || "user",
        createdAt: u.created_at,
        reportsCount: parseInt(u.reports_count || 0, 10),
        totalStorageBytes: parseInt(u.reports_count || 0, 10) * 1024 * 180,
      }));
    } catch (error) {
      console.error("Error getting user stats:", error);
      return [];
    }
  },

  getStorageBreakdown: async () => {
    try {
      const userStats = await adminStatsService.getUserStats();
      return userStats.map((stat) => ({
        userId: stat.userId,
        email: stat.email,
        fullName: stat.fullName,
        storageMB: Math.round((stat.totalStorageBytes / (1024 * 1024)) * 100) / 100,
        reportCount: stat.reportsCount,
        averageReportSize: stat.reportsCount > 0 ? 180 : 0,
      }));
    } catch (error) {
      console.error("Error getting storage breakdown:", error);
      return [];
    }
  },

  deleteReport: async (reportId) => {
    try {
      await apiClient.deleteAdminReport(reportId);
      return true;
    } catch (error) {
      console.error("Error deleting report:", error);
      return false;
    }
  },

  deleteUser: async (userId) => {
    try {
      await apiClient.deleteAdminUser(userId);
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  },

  updateUserRole: async (userId, role) => {
    try {
      const res = await apiClient.updateUserRole(userId, role);
      return { success: true, res };
    } catch (error) {
      console.error("Error updating user role:", error);
      return { success: false, error: error.message };
    }
  },

  getAllReports: async () => {
    try {
      const reports = await apiClient.getAdminReports();
      return reports || [];
    } catch (error) {
      console.error("Error fetching reports:", error);
      return [];
    }
  },

  getDbTables: async () => {
    try {
      return await apiClient.getAdminDbTables();
    } catch (error) {
      console.error("Error getting DB tables:", error);
      return [];
    }
  },

  getDbTableRows: async (tableName, limit = 50, offset = 0) => {
    try {
      return await apiClient.getAdminDbTableRows(tableName, limit, offset);
    } catch (error) {
      console.error("Error getting DB table rows:", error);
      return { table_name: tableName, total_rows: 0, rows: [] };
    }
  },

  executeSqlQuery: async (sql) => {
    try {
      return await apiClient.executeAdminSqlQuery(sql);
    } catch (error) {
      console.error("Error executing SQL query:", error);
      throw error;
    }
  },

  reindexReportChunks: async (reportId) => {
    try {
      return await apiClient.reindexReportChunks(reportId);
    } catch (error) {
      console.error("Error reindexing report RAG chunks:", error);
      throw error;
    }
  },

  getMinioObjects: async () => {
    try {
      return await apiClient.getAdminMinioObjects();
    } catch (error) {
      console.error("Error getting MinIO objects:", error);
      return { bucket_name: "labsense-reports", total_objects: 0, objects: [] };
    }
  },

  subscribeToReports: () => () => {},
  subscribeToProfiles: () => () => {},
  unsubscribeAll: () => {},
};
