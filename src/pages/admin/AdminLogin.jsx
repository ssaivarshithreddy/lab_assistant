import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { adminAuthService } from "@/services/adminAuthService";
const AdminLogin = () => {
    const navigate = useNavigate();
    const credentials = adminAuthService.getAdminCredentials();
    const [email, setEmail] = useState(credentials.email);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        if (!email || !password) {
            setError("Email and password are required");
            return;
        }
        setLoading(true);
        try {
            const result = await adminAuthService.login(email, password);
            if (result.success) {
                toast.success("Admin logged in successfully!");
                navigate("/admin/dashboard", { replace: true });
            }
            else {
                setError(result.error || "Login failed");
                toast.error(result.error || "Login failed");
            }
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : "An error occurred";
            setError(errorMsg);
            toast.error(errorMsg);
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center border-b">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <LogIn className="w-6 h-6 text-blue-600"/>
            </div>
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <p className="text-sm text-slate-500 mt-2">Access the administrator dashboard</p>
        </CardHeader>
        <CardContent className="pt-6">
          {error && (<div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0"/>
              <span className="text-sm text-red-700">{error}</span>
            </div>)}

          <Alert className="mb-4 bg-green-50 border-green-200">
            <AlertDescription className="text-sm">
              <span className="font-semibold text-green-900">Admin Credentials:</span>
              <div className="mt-2 space-y-1 text-green-800">
                <p><span className="font-medium">Email:</span> <code className="bg-white px-2 py-1 rounded">{credentials.email}</code></p>
                <p><span className="font-medium">Password:</span> <code className="bg-white px-2 py-1 rounded">{credentials.password}</code></p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}/>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}/>
            </div>

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? (<>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                  Logging in...
                </>) : ("Login")}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-slate-600">
              <span className="font-semibold">Note:</span> Use the credentials shown above to access the admin panel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>);
};
export default AdminLogin;
