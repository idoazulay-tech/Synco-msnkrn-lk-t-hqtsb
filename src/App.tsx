import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
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

const RescheduleRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/task/${id}/edit`} replace />;
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
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
