import { useState, useEffect, useMemo } from "react";
import {
  Stethoscope,
  Calendar as CalendarIcon,
  Clock,
  Video,
  Building2,
  Star,
  CheckCircle2,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  ArrowRight,
  XCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/AuthProvider";
import { appointmentService, SPECIALIST_DOCTORS } from "@/services/appointmentService";
import { getLocalReports } from "@/lib/localReports";
import { cn } from "@/lib/utils";

export default function Appointments() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("doctors");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [appointments, setAppointments] = useState([]);

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState(new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]);
  const [bookingTime, setBookingTime] = useState("10:00 AM");
  const [consultationType, setConsultationType] = useState("Video Consultation");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Latest user report abnormal metrics for smart recommendations
  const latestReport = useMemo(() => {
    const reports = getLocalReports(user?.id);
    return reports[0] || null;
  }, [user]);

  const abnormalMetrics = useMemo(() => {
    if (!latestReport?.values) return [];
    let vals = latestReport.values;
    if (typeof vals === "string") {
      try { vals = JSON.parse(vals); } catch (e) { vals = {}; }
    }
    return Object.entries(vals)
      .filter(([, v]) => v?.status === "low" || v?.status === "high")
      .map(([k]) => k.toLowerCase());
  }, [latestReport]);

  const recommendedDoctors = useMemo(() => {
    return appointmentService.getRecommendedDoctors(abnormalMetrics);
  }, [abnormalMetrics]);

  useEffect(() => {
    const list = appointmentService.getAppointments(user?.id);
    setAppointments(list);
  }, [user]);

  const handleBook = () => {
    if (!selectedDoctor) return;
    setIsSubmitting(true);
    try {
      const newApt = appointmentService.bookAppointment(
        {
          doctorName: selectedDoctor.name,
          specialty: selectedDoctor.specialty,
          hospital: selectedDoctor.hospital,
          date: bookingDate,
          time: bookingTime,
          type: consultationType,
          notes: clinicalNotes || `Consultation regarding ${latestReport?.file_name || "lab report"}`,
          doctorImage: selectedDoctor.image,
          fee: selectedDoctor.fee,
        },
        user?.id
      );

      setAppointments((prev) => [newApt, ...prev]);
      toast.success(`Appointment booked with ${selectedDoctor.name}!`);
      setSelectedDoctor(null);
      setClinicalNotes("");
      setActiveTab("my_appointments");
    } catch (err) {
      toast.error("Failed to book appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = (aptId) => {
    const success = appointmentService.cancelAppointment(aptId, user?.id);
    if (success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === aptId ? { ...a, status: "Cancelled" } : a))
      );
      toast.success("Appointment cancelled.");
    }
  };

  const filteredDoctors = useMemo(() => {
    return SPECIALIST_DOCTORS.filter((doc) => {
      const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q) ||
        doc.hospital.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-card rounded-[2rem] p-6 sm:p-8 bg-gradient-to-r from-card via-card to-indigo-500/10 border-indigo-500/20 relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Stethoscope className="h-3.5 w-3.5" /> Doctor Consultation & Specialist Booking
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Connect with Top Medical Specialists
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium">
              Schedule HD video consultations or in-person clinic visits with board-certified hematologists, endocrinologists, and hepatologists.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => setActiveTab("my_appointments")}
              variant="outline"
              className="border-indigo-500/30 bg-card text-foreground hover:bg-muted rounded-2xl text-xs font-bold shadow-md px-5 h-11"
            >
              <CalendarIcon className="h-4 w-4 mr-2 text-indigo-500" />
              My Appointments ({appointments.filter((a) => a.status === "Confirmed").length})
            </Button>
          </div>
        </div>
      </div>

      {/* Smart Specialist Match Banner (If user has abnormal lab values) */}
      {abnormalMetrics.length > 0 && (
        <Card className="glass-card rounded-3xl border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-card p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md glow-indigo">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">AI Recommended Specialists for Your Lab Results</h3>
                  <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30 text-[10px] uppercase font-bold">
                    Lab Matched
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on out-of-reference values (<strong>{abnormalMetrics.join(", ").toUpperCase()}</strong>) in your latest report, we recommend consulting:
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {recommendedDoctors.map((doc) => (
                <Button
                  key={doc.id}
                  onClick={() => setSelectedDoctor(doc)}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold h-9 px-3.5 shadow-sm"
                >
                  Book {doc.name.split(",")[0]}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border p-1.5 rounded-2xl inline-flex gap-1 shadow-sm">
          <TabsTrigger value="doctors" className="text-xs rounded-xl font-bold px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Stethoscope className="h-4 w-4 mr-1.5 inline-block" /> Find Specialists ({SPECIALIST_DOCTORS.length})
          </TabsTrigger>
          <TabsTrigger value="my_appointments" className="text-xs rounded-xl font-bold px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <CalendarIcon className="h-4 w-4 mr-1.5 inline-block" /> Booked Consultations ({appointments.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DOCTORS CATALOG */}
        <TabsContent value="doctors" className="space-y-6">
          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by doctor name, specialty, hospital..."
                className="pl-10 bg-card border-border text-xs rounded-2xl focus-visible:ring-indigo-500 h-10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {["all", "hematology", "endocrinology", "hepatology", "nephrology", "cardiology"].map((cat) => (
                <Button
                  key={cat}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "rounded-xl text-xs font-bold capitalize transition-all border h-8",
                    selectedCategory === cat
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md glow-indigo"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Doctors Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDoctors.map((doc) => (
              <Card key={doc.id} className="glass-card rounded-3xl border-border p-6 space-y-4 hover:border-indigo-500/40 transition-all shadow-lg flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={doc.image}
                      alt={doc.name}
                      className="h-16 w-16 rounded-2xl object-cover border border-border shadow-md"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-sm text-foreground">{doc.name}</h4>
                        <ShieldCheck className="h-4 w-4 text-indigo-500 shrink-0" />
                      </div>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">{doc.specialty}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {doc.hospital}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{doc.bio}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="h-3.5 w-3.5 fill-amber-500" /> {doc.rating} <span className="text-muted-foreground font-normal">({doc.reviewsCount})</span>
                    </div>
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                      {doc.experience}
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Consultation Fee</span>
                    <div className="text-lg font-extrabold text-foreground">{doc.fee}</div>
                  </div>
                  <Button
                    onClick={() => setSelectedDoctor(doc)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs px-4 h-10 shadow-md glow-indigo"
                  >
                    Book Consultation
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: MY BOOKED APPOINTMENTS */}
        <TabsContent value="my_appointments" className="space-y-6">
          {appointments.length === 0 ? (
            <Card className="glass-card rounded-3xl p-12 text-center border-border space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-500 mx-auto">
                <CalendarIcon className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">No Booked Appointments</h3>
                <p className="text-xs text-muted-foreground mt-1">You haven't scheduled any doctor consultations yet.</p>
              </div>
              <Button onClick={() => setActiveTab("doctors")} className="bg-indigo-600 text-white rounded-xl text-xs font-bold">
                Find a Specialist
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {appointments.map((apt) => (
                <Card key={apt.id} className="glass-card rounded-3xl border-border p-6 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {apt.doctorImage ? (
                        <img src={apt.doctorImage} alt={apt.doctorName} className="h-14 w-14 rounded-2xl object-cover border border-border shrink-0" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 font-bold shrink-0">
                          <UserCheck className="h-7 w-7" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-base text-foreground">{apt.doctorName}</h4>
                          <Badge
                            className={cn(
                              "capitalize text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                              apt.status === "Confirmed"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            )}
                          >
                            {apt.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">{apt.specialty}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-medium mt-1">
                          <span className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5 text-indigo-500" /> {apt.date}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-indigo-500" /> {apt.time}</span>
                          <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5 text-indigo-500" /> {apt.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {apt.status === "Confirmed" && (
                        <>
                          <Button
                            onClick={() => toast.info(`Video Call room will activate 5 minutes prior to ${apt.time}`)}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs h-9 px-4 shadow-md"
                          >
                            <Video className="h-3.5 w-3.5 mr-1.5" /> Join HD Video Call
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelAppointment(apt.id)}
                            className="text-rose-500 hover:bg-rose-500/10 rounded-xl text-xs h-9 px-3"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Booking Dialog Modal */}
      {selectedDoctor && (
        <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
          <DialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground text-lg font-bold flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-indigo-500" /> Book Consultation with {selectedDoctor.name.split(",")[0]}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {selectedDoctor.specialty} • {selectedDoctor.hospital}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Consultation Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Consultation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConsultationType("Video Consultation")}
                    className={cn(
                      "rounded-xl text-xs font-bold justify-start border h-10",
                      consultationType === "Video Consultation"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Video className="h-4 w-4 mr-2" /> Video Call
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConsultationType("In-Person Clinic Visit")}
                    className={cn(
                      "rounded-xl text-xs font-bold justify-start border h-10",
                      consultationType === "In-Person Clinic Visit"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Building2 className="h-4 w-4 mr-2" /> In-Person Clinic
                  </Button>
                </div>
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Select Preferred Date</label>
                <Input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="bg-muted/50 border-border text-xs rounded-xl h-10"
                />
              </div>

              {/* Time Slots */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Select Available Time Slot</label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedDoctor.timeSlots.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      variant="outline"
                      onClick={() => setBookingTime(slot)}
                      className={cn(
                        "rounded-xl text-xs font-bold border h-9",
                        bookingTime === slot
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1.5" /> {slot}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Clinical Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Clinical Reason / Report Notes</label>
                <Textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Consult regarding low hemoglobin levels on recent CBC report..."
                  className="bg-muted/50 border-border text-xs rounded-xl p-3"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/60">
              <Button variant="ghost" onClick={() => setSelectedDoctor(null)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleBook}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs px-5 shadow-md glow-indigo"
              >
                Confirm Appointment ({selectedDoctor.fee})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
