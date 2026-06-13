import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from "react-router-dom";
import { useTaskStore } from "@/store/taskStore";
import HomePage from "./pages/HomePage";
import DayViewPage from "./pages/DayViewPage";
import MonthViewPage from "./pages/MonthViewPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import AddTaskPage from "./pages/AddTaskPage";
import EditTaskPage from "./pages/EditTaskPage";
import StandbyPage from "./pages/StandbyPage";
import SettingsPage from "./pages/SettingsPage";
import StatisticsPage from "./pages/StatisticsPage";
import ArchivePage from "./pages/ArchivePage";
import AboutPage from "./pages/AboutPage";
import AILabPage from "./pages/AILabPage";
import ShikulPage from "./pages/ShikulPage";
import NotFound from "./pages/NotFound";
import OnboardingPage from "./pages/OnboardingPage";
import PriorityPlannerPage from "./pages/PriorityPlannerPage";
import BrainSharePage from "./pages/BrainSharePage";

const MIGRATION_FLAG = 'synco_migrated_v1';

const AppInitializer = () => {
  const { migrateLocalTasksToServer, syncTasksFromServer } = useTaskStore();

  useEffect(() => {
    const run = async () => {
      try {
        const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG);
        if (!alreadyMigrated) {
          await migrateLocalTasksToServer();
          localStorage.setItem(MIGRATION_FLAG, 'true');
          console.log('[Synco] Migration to DB complete.');
        }
        await syncTasksFromServer();
      } catch (e) {
        console.warn('[Synco] DB sync failed — using local data as fallback:', e);
      }
    };
    run();
  }, []);

  return null;
};

const RescheduleRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/task/${id}/edit`} replace />;
};

const ONBOARDING_CHECKED_KEY = 'synco_onboarding_checked';

const OnboardingGate = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/onboarding') return;
    if (sessionStorage.getItem(ONBOARDING_CHECKED_KEY)) return;

    const check = async () => {
      try {
        const res = await fetch('/api/onboarding/default-user');
        if (!res.ok) return;
        const data = await res.json();
        sessionStorage.setItem(ONBOARDING_CHECKED_KEY, 'true');
        if (!data.status || data.status === 'NOT_STARTED') {
          navigate('/onboarding', { replace: true });
        }
      } catch {
        // offline / server not ready — skip silently
      }
    };
    check();
  }, [navigate, location.pathname]);

  return null;
};

const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const url = queryKey[0] as string;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppInitializer />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OnboardingGate />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/day" element={<DayViewPage />} />
          <Route path="/month" element={<MonthViewPage />} />
          <Route path="/task/:id" element={<TaskDetailPage />} />
          <Route path="/task/:id/reschedule" element={<RescheduleRedirect />} />
          <Route path="/task/:id/edit" element={<EditTaskPage />} />
          <Route path="/add" element={<AddTaskPage />} />
          <Route path="/standby" element={<StandbyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/ai-lab" element={<AILabPage />} />
          <Route path="/shikul" element={<ShikulPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/planner" element={<PriorityPlannerPage />} />
          <Route path="/brain-share" element={<BrainSharePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
