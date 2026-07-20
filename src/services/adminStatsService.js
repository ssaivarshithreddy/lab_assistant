import { adminSupabase, isUsingAdminFallback } from "@/integrations/supabase/adminClient";

// Helper to fetch registered profiles (emails + created dates) with listUsers and profiles fallbacks
const fetchUserProfilesMap = async () => {
  const profilesMap = new Map();
  
  // 1. Try to fetch from auth admin listUsers API (requires service role key)
  if (!isUsingAdminFallback) {
    try {
      console.log("[adminStatsService] Attempting to fetch users from auth admin...");
      const { data: authData, error: authError } = await adminSupabase.auth.admin.listUsers();
      if (!authError && authData?.users) {
        authData.users.forEach((u) => {
          if (u.id && u.email) {
            profilesMap.set(u.id, {
              email: u.email,
              createdAt: u.created_at || new Date().toISOString()
            });
          }
        });
        console.log(`[adminStatsService] Resolved ${profilesMap.size} user profiles from auth admin`);
        return profilesMap;
      } else if (authError) {
        console.warn("[adminStatsService] Auth admin fetch failed:", authError.message);
      }
    } catch (err) {
      console.warn("[adminStatsService] Auth admin fetch threw exception:", err);
    }
  } else {
    console.log("[adminStatsService] Skipping auth admin fetch (no valid service role key configured)");
  }

  // 2. Try to fetch from profiles table fallback
  try {
    console.log("[adminStatsService] Attempting to fetch users from profiles table...");
    const { data: profiles, error: profilesError } = await adminSupabase
      .from("profiles")
      .select("id, email, created_at");
    
    if (!profilesError && profiles) {
      profiles.forEach((p) => {
        if (p.id && p.email) {
          profilesMap.set(p.id, {
            email: p.email,
            createdAt: p.created_at || new Date().toISOString()
          });
        }
      });
      console.log(`[adminStatsService] Resolved ${profilesMap.size} user profiles from profiles table`);
    } else if (profilesError) {
      console.warn("[adminStatsService] Profiles query failed:", profilesError.message);
    }
  } catch (err) {
    console.warn("[adminStatsService] Profiles fallback threw exception:", err);
  }

  return profilesMap;
};

export const adminStatsService = {
  // Store active subscriptions for cleanup
  subscriptions: new Map(),

  getSystemStats: async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      console.log("[adminStatsService] Fetching system stats from Supabase...");

      // Fetch all reports from the database
      const { data: reports, error: reportsError } = await adminSupabase
        .from("reports")
        .select("id, user_id, created_at, file_name, values, prediction, raw_text");

      if (reportsError) {
        console.error("[adminStatsService] Error fetching reports:", reportsError);
        return null;
      }

      // Resolve profiles map
      const profilesMap = await fetchUserProfilesMap();

      console.log(`[adminStatsService] Retrieved ${reports?.length || 0} reports from database`);

      if (!reports || reports.length === 0) {
        console.log("[adminStatsService] No reports found in database");
        return {
          totalUsers: profilesMap.size,
          totalReports: 0,
          totalStorageBytes: 0,
          totalStorageMB: 0,
          averageStoragePerUser: 0,
          usersCreatedToday: 0,
          usersCreatedThisMonth: 0,
          reportsCreatedToday: 0,
          reportsCreatedThisMonth: 0,
        };
      }

      // Calculate totals from reports
      let totalStorageBytes = 0;
      const uniqueUsers = new Set();
      let usersCreatedToday = 0;
      let usersCreatedThisMonth = 0;
      let reportsCreatedToday = 0;
      let reportsCreatedThisMonth = 0;

      reports.forEach((report) => {
        // Attach user email from our map
        const profile = report.user_id ? profilesMap.get(report.user_id) : null;
        report.user = { email: profile ? profile.email : null };
        
        if (report.user_id) {
          uniqueUsers.add(report.user_id);
        }
        const fileSize = JSON.stringify(report).length;
        totalStorageBytes += fileSize;

        const createdAt = new Date(report.created_at);
        if (createdAt >= today) reportsCreatedToday++;
        if (createdAt >= monthStart) reportsCreatedThisMonth++;
      });

      // For user creation dates, we can get approximate data from first report
      const userFirstReports = new Map();
      reports.forEach((report) => {
        const userId = report.user_id;
        if (!userId) return;
        const reportDate = new Date(report.created_at);
        const existingDate = userFirstReports.get(userId);
        if (!existingDate || reportDate < existingDate) {
          userFirstReports.set(userId, reportDate);
        }
      });

      userFirstReports.forEach((date) => {
        if (date >= today) usersCreatedToday++;
        if (date >= monthStart) usersCreatedThisMonth++;
      });

      const totalUsers = profilesMap.size || uniqueUsers.size;
      const totalReports = reports.length;

      return {
        totalUsers,
        totalReports,
        totalStorageBytes,
        totalStorageMB: Math.round(totalStorageBytes / (1024 * 1024) * 100) / 100,
        averageStoragePerUser: totalUsers > 0 ? Math.round((totalStorageBytes / totalUsers) / 1024) : 0,
        usersCreatedToday,
        usersCreatedThisMonth,
        reportsCreatedToday,
        reportsCreatedThisMonth,
      };
    } catch (error) {
      console.error("Error getting system stats:", error);
      return null;
    }
  },

  getUserStats: async () => {
    try {
      const { data: reports, error: reportsError } = await adminSupabase
        .from("reports")
        .select("id, user_id, created_at, file_name, values, prediction, raw_text");

      if (reportsError) {
        console.error("Error fetching reports:", reportsError);
        return [];
      }

      // Resolve profiles map
      const profilesMap = await fetchUserProfilesMap();

      const userStatsMap = new Map();

      // 1. Initialize userStatsMap with all registered profiles (includes users with 0 reports)
      profilesMap.forEach((info, userId) => {
        userStatsMap.set(userId, {
          userId,
          email: info.email,
          createdAt: info.createdAt,
          reportsCount: 0,
          totalStorageBytes: 0,
          lastActivityDate: null,
        });
      });

      // 2. Process reports and aggregate stats
      reports?.forEach((report) => {
        const userId = report.user_id || "unknown_user";

        if (!userStatsMap.has(userId)) {
          const userEmail = report.user_id ? `User_${report.user_id.slice(0, 8)}` : "Unknown User";
          userStatsMap.set(userId, {
            userId,
            email: userEmail,
            createdAt: report.created_at,
            reportsCount: 0,
            totalStorageBytes: 0,
            lastActivityDate: null,
          });
        }

        const stats = userStatsMap.get(userId);
        stats.reportsCount += 1;
        stats.totalStorageBytes += JSON.stringify(report).length;

        if (!stats.lastActivityDate || new Date(report.created_at) > new Date(stats.lastActivityDate)) {
          stats.lastActivityDate = report.created_at;
        }

        // Update created date to earliest report date (since backfilled profiles default to now())
        if (new Date(report.created_at) < new Date(stats.createdAt)) {
          stats.createdAt = report.created_at;
        }
      });

      return Array.from(userStatsMap.values()).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
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
        storageMB: Math.round((stat.totalStorageBytes / (1024 * 1024)) * 100) / 100,
        reportCount: stat.reportsCount,
        averageReportSize: stat.reportsCount > 0 ? Math.round((stat.totalStorageBytes / stat.reportsCount) / 1024) : 0,
      }));
    } catch (error) {
      console.error("Error getting storage breakdown:", error);
      return [];
    }
  },

  deleteReport: async (reportId) => {
    try {
      const { error } = await adminSupabase.from("reports").delete().eq("id", reportId);
      if (error) {
        console.error("Error deleting report:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error deleting report:", error);
      return false;
    }
  },

  deleteUser: async (userId) => {
    try {
      // 1. Delete all reports of the user
      let query = adminSupabase.from("reports").delete();
      if (userId === "unknown_user") {
        query = query.is("user_id", null);
      } else {
        query = query.eq("user_id", userId);
      }
      
      const { error: reportsError } = await query;
      if (reportsError) {
        console.error("Error deleting reports:", reportsError);
        return false;
      }
      
      // 2. Delete profile of the user (only for real users)
      if (userId !== "unknown_user") {
        const { error: profileError } = await adminSupabase.from("profiles").delete().eq("id", userId);
        if (profileError) {
          console.warn("Error deleting profile:", profileError);
        }
        
        // 3. Delete from auth.users (if using valid service role key)
        if (!isUsingAdminFallback) {
          try {
            const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId);
            if (authError) {
              console.warn("Error deleting auth user:", authError.message);
            }
          } catch (err) {
            console.warn("Auth admin delete threw exception:", err);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error in deleteUser:", error);
      return false;
    }
  },

  getAllReports: async () => {
    try {
      const { data: reports, error } = await adminSupabase
        .from("reports")
        .select("id, user_id, file_name, created_at, summary")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching reports:", error);
        return [];
      }

      if (!reports) return [];

      // Resolve profiles map
      const profilesMap = await fetchUserProfilesMap();

      return reports.map((report) => {
        const profile = report.user_id ? profilesMap.get(report.user_id) : null;
        return {
          ...report,
          user: { email: profile ? profile.email : null }
        };
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      return [];
    }
  },

  // Subscribe to real-time changes in reports table
  subscribeToReports: (onDataChange) => {
    const subscription = adminSupabase
      .channel("reports_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        (payload) => {
          console.log("Realtime update:", payload);
          onDataChange();
        }
      )
      .subscribe();

    const unsubscribe = () => {
      adminSupabase.removeChannel(subscription);
    };

    adminStatsService.subscriptions.set("reports_changes", subscription);
    return unsubscribe;
  },

  // Subscribe to real-time changes in profiles table
  subscribeToProfiles: (onDataChange) => {
    const subscription = adminSupabase
      .channel("profiles_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          console.log("Realtime profile update:", payload);
          onDataChange();
        }
      )
      .subscribe();

    const unsubscribe = () => {
      adminSupabase.removeChannel(subscription);
    };

    adminStatsService.subscriptions.set("profiles_changes", subscription);
    return unsubscribe;
  },

  // Cleanup all subscriptions
  unsubscribeAll: () => {
    adminStatsService.subscriptions.forEach((subscription) => {
      adminSupabase.removeChannel(subscription);
    });
    adminStatsService.subscriptions.clear();
  },
};
