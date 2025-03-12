
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

// Helper component to conditionally render header
const HeaderWrapper = () => {
  const location = useLocation();
  // Don't show header on index page (model viewer) or login page
  return location.pathname !== '/' && location.pathname !== '/login' ? <Header /> : null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex h-full flex-col">
            <Routes>
              <Route path="*" element={<HeaderWrapper />} />
            </Routes>
            <main className="flex-1 overflow-y-auto">
              <Routes>
                {/* Main app with model viewer, protected by authentication */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                
                {/* Make login accessible directly */}
                <Route path="/login" element={<Login />} />
                
                {/* Redirect register route to login */}
                <Route path="/register" element={<Navigate to="/login" />} />
                
                {/* Redirect any other undefined routes to 404 page */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
