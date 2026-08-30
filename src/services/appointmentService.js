/**
 * Doctor Appointment & Specialist Recommendation Service
 * Stores specialist doctors catalog, handles local storage appointment persistence,
 * and matches abnormal lab markers to medical specialists.
 */

export const SPECIALIST_DOCTORS = [
  {
    id: "doc-1",
    name: "Dr. Sarah Jenkins, MD",
    specialty: "Hematologist & Blood Specialist",
    category: "hematology",
    hospital: "St. Jude Medical Center",
    experience: "14 years exp.",
    rating: 4.9,
    reviewsCount: 128,
    fee: "$120",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80",
    matchingMetrics: ["hemoglobin", "wbc", "rbc", "platelets", "mcv", "mch", "mchc"],
    bio: "Board-certified Hematologist specializing in anemia management, leukocyte disorders, and comprehensive blood cell analysis.",
    availableDays: ["Mon", "Wed", "Fri"],
    timeSlots: ["09:00 AM", "11:30 AM", "02:30 PM", "04:00 PM"],
  },
  {
    id: "doc-2",
    name: "Dr. Marcus Vance, MD",
    specialty: "Endocrinologist & Metabolic Care",
    category: "endocrinology",
    hospital: "Metabolic Health Institute",
    experience: "12 years exp.",
    rating: 4.8,
    reviewsCount: 94,
    fee: "$135",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80",
    matchingMetrics: ["glucose", "hba1c"],
    bio: "Expert in glycemic management, insulin sensitivity optimization, and pre-diabetes preventive therapy.",
    availableDays: ["Tue", "Thu", "Sat"],
    timeSlots: ["10:00 AM", "01:00 PM", "03:30 PM", "05:00 PM"],
  },
  {
    id: "doc-3",
    name: "Dr. Elena Rostova, MD",
    specialty: "Hepatologist & Liver Specialist",
    category: "hepatology",
    hospital: "University Digestive & Liver Center",
    experience: "16 years exp.",
    rating: 4.9,
    reviewsCount: 156,
    fee: "$150",
    image: "https://images.unsplash.com/photo-1594824813571-26534450e651?auto=format&fit=crop&w=400&q=80",
    matchingMetrics: ["alt", "ast", "alp", "bilirubin"],
    bio: "Leading specialist in liver transaminase evaluation, hepatic steatosis, and biliary system health.",
    availableDays: ["Mon", "Tue", "Thu"],
    timeSlots: ["08:30 AM", "11:00 AM", "02:00 PM", "04:30 PM"],
  },
  {
    id: "doc-4",
    name: "Dr. David Kim, MD",
    specialty: "Nephrologist & Kidney Specialist",
    category: "nephrology",
    hospital: "Renal Care Center",
    experience: "11 years exp.",
    rating: 4.7,
    reviewsCount: 82,
    fee: "$130",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80",
    matchingMetrics: ["creatinine", "urea", "bun", "sodium", "potassium", "chloride"],
    bio: "Specialist in renal filtration function, electrolyte equilibrium, and early kidney health preservation.",
    availableDays: ["Wed", "Fri", "Sat"],
    timeSlots: ["09:30 AM", "12:00 PM", "03:00 PM"],
  },
  {
    id: "doc-5",
    name: "Dr. Robert Hayes, MD",
    specialty: "Cardiologist & Internal Medicine",
    category: "cardiology",
    hospital: "Heart & Vascular Institute",
    experience: "18 years exp.",
    rating: 5.0,
    reviewsCount: 210,
    fee: "$160",
    image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=400&q=80",
    matchingMetrics: ["crp", "calcium"],
    bio: "Senior Cardiologist specializing in cardiovascular inflammation assessment and preventive internal medicine.",
    availableDays: ["Mon", "Wed", "Thu"],
    timeSlots: ["10:30 AM", "01:30 PM", "04:30 PM"],
  },
];

export const appointmentService = {
  getDoctors: () => SPECIALIST_DOCTORS,

  getRecommendedDoctors: (abnormalMetrics = []) => {
    if (!abnormalMetrics.length) return SPECIALIST_DOCTORS.slice(0, 3);
    const matched = SPECIALIST_DOCTORS.filter((doc) =>
      doc.matchingMetrics.some((metric) => abnormalMetrics.includes(metric.toLowerCase()))
    );
    return matched.length > 0 ? matched : SPECIALIST_DOCTORS.slice(0, 3);
  },

  getAppointments: (userId) => {
    try {
      const key = `labsense_appointments_${userId || "default"}`;
      const raw = localStorage.getItem(key);
      if (!raw) {
        // Seed default upcoming appointment for demonstration
        const sample = [
          {
            id: "apt-101",
            doctorName: "Dr. Sarah Jenkins, MD",
            specialty: "Hematologist & Blood Specialist",
            hospital: "St. Jude Medical Center",
            date: new Date(Date.now() + 86400000 * 2).toLocaleDateString(),
            time: "10:30 AM",
            type: "Video Consultation",
            status: "Confirmed",
            notes: "Review recent low hemoglobin and iron levels.",
            doctorImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80",
            fee: "$120",
          },
        ];
        localStorage.setItem(key, JSON.stringify(sample));
        return sample;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to load appointments:", e);
      return [];
    }
  },

  bookAppointment: (data, userId) => {
    try {
      const key = `labsense_appointments_${userId || "default"}`;
      const current = appointmentService.getAppointments(userId);
      const newApt = {
        id: `apt-${Date.now()}`,
        doctorName: data.doctorName,
        specialty: data.specialty,
        hospital: data.hospital,
        date: data.date,
        time: data.time,
        type: data.type || "Video Consultation",
        status: "Confirmed",
        notes: data.notes || "Lab report consultation",
        doctorImage: data.doctorImage,
        fee: data.fee,
        createdAt: new Date().toISOString(),
      };
      const updated = [newApt, ...current];
      localStorage.setItem(key, JSON.stringify(updated));
      return newApt;
    } catch (e) {
      console.error("Booking error:", e);
      throw new Error("Failed to save appointment");
    }
  },

  cancelAppointment: (appointmentId, userId) => {
    try {
      const key = `labsense_appointments_${userId || "default"}`;
      const current = appointmentService.getAppointments(userId);
      const updated = current.map((a) =>
        a.id === appointmentId ? { ...a, status: "Cancelled" } : a
      );
      localStorage.setItem(key, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error("Cancel error:", e);
      return false;
    }
  },
};
