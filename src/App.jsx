import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import GameLayout from '@/components/game/GameLayout';
import Home from '@/pages/Home';
import Elections from '@/pages/Elections';

import ElectionDetail from '@/pages/ElectionDetail';
import RegisterCandidate from '@/pages/RegisterCandidate';
import Parties from '@/pages/Parties';
import CreateParty from '@/pages/CreateParty';
import PartyDetail from '@/pages/PartyDetail';
import Properties from '@/pages/Properties';
import Development from '@/pages/Development';
import News from '@/pages/News';
import Chat from '@/pages/Chat';
import Leaderboard from '@/pages/Leaderboard';
import Profile from '@/pages/Profile';
import CampaignPage from '@/pages/CampaignPage';
import PastElectionResults from '@/pages/PastElectionResults';
import UPI from '@/pages/UPI';
import VidhanSabhaDiscussion from '@/pages/VidhanSabhaDiscussion';
import PrivateMessages from '@/pages/PrivateMessages';
import Business from '@/pages/Business';
import Alliances from '@/pages/Alliances';
import ElectionData from '@/pages/ElectionData';
import Government from '@/pages/Government';
import PublicVote from '@/pages/PublicVote';
import NationalMap from '@/pages/NationalMap';
import States from '@/pages/States';
import StateDetail from '@/pages/StateDetail';
import AdminElections from '@/pages/AdminElections';
import Assembly from '@/pages/Assembly';
import Economy from '@/pages/Economy';
import BudgetPage from '@/pages/BudgetPage';
import Salary from '@/pages/Salary';
import Social from '@/pages/Social';
import MinistryHub from '@/pages/MinistryHub';
import PartyHQ from '@/pages/PartyHQ';
import PartyChat from '@/pages/PartyChat';
import Tasks from '@/pages/Tasks';
import Legal from '@/pages/Legal';
import Popularity from '@/pages/Popularity';
import AdminAI from '@/pages/AdminAI';
import Admin from '@/pages/Admin';
import Ministers from '@/pages/Ministers';
import FormationRequests from '@/pages/FormationRequest';
import Parliament from '@/pages/Parliament';
import ParliamentSession from '@/pages/ParliamentSession';
import BillApprovals from '@/pages/BillApprovals';
import Bills from '@/pages/Bills';
import SeatSharing from '@/pages/SeatSharing';
import Courts from '@/pages/Courts';
import ConstituencyWork from '@/pages/ConstituencyWork';
import MinistryOffice from '@/pages/MinistryOffice';
// Protest (opposition street power) and the Speaker's Office (bill admission
// and certification) live under Parliament in the navigation.
import Protests from '@/pages/Protest';
import SpeakerOffice from '@/pages/SpeakerOffice';
import { loadSeatConfigs } from '@/lib/stateSeatConfig';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Apply admin-configured seat overrides (DB → runtime config) app-wide.
  useEffect(() => { loadSeatConfigs().catch(() => {}); }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/public-vote/:electionId" element={<PublicVote />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<GameLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/nation" element={<NationalMap />} />
          <Route path="/states" element={<States />} />
          <Route path="/states/:stateId" element={<StateDetail />} />
          <Route path="/admin/elections" element={<AdminElections />} />
          <Route path="/assembly/:stateId" element={<Assembly />} />
          <Route path="/economy" element={<Economy />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/salary" element={<Salary />} />
          <Route path="/social" element={<Social />} />
          <Route path="/ministries" element={<MinistryHub />} />
          <Route path="/party-hq" element={<PartyHQ />} />
          <Route path="/party-chat" element={<PartyChat />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/popularity" element={<Popularity />} />
          <Route path="/admin/ai" element={<AdminAI />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/ministers" element={<Ministers />} />
          <Route path="/formation-requests" element={<FormationRequests />} />
          <Route path="/parliament" element={<Parliament />} />
          <Route path="/parliament/president" element={<BillApprovals authority="president" />} />
          <Route path="/parliament/governor" element={<BillApprovals authority="governor" />} />
          <Route path="/parliament/:house" element={<ParliamentSession />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/seat-sharing" element={<SeatSharing />} />
          <Route path="/courts" element={<Courts />} />
          <Route path="/elections" element={<Elections />} />

          <Route path="/elections/:id" element={<ElectionDetail />} />
          <Route path="/elections/:id/register" element={<RegisterCandidate />} />
          <Route path="/elections/:electionId/campaign/:candidatureId" element={<CampaignPage />} />
          <Route path="/past-results" element={<PastElectionResults />} />
          <Route path="/upi" element={<UPI />} />
          <Route path="/legislative-assembly" element={<VidhanSabhaDiscussion />} />
          <Route path="/vidhan-sabha" element={<Navigate to="/legislative-assembly" replace />} />
          <Route path="/protests" element={<Protests />} />
          <Route path="/speaker-office" element={<SpeakerOffice />} />
          <Route path="/messages" element={<PrivateMessages />} />
          <Route path="/business" element={<Business />} />
          <Route path="/alliances" element={<Alliances />} />
          <Route path="/government" element={<Government />} />
          <Route path="/election-data" element={<ElectionData />} />
          <Route path="/parties" element={<Parties />} />
          <Route path="/parties/create" element={<CreateParty />} />
          <Route path="/parties/:id" element={<PartyDetail />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/vehicles" element={<Navigate to="/properties" replace />} />
          <Route path="/development" element={<Development />} />
          <Route path="/constituency-work" element={<ConstituencyWork />} />
          <Route path="/ministry-office" element={<MinistryOffice />} />
          <Route path="/news" element={<News />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:playerId" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
