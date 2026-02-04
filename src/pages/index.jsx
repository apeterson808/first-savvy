import Layout from "./Layout.jsx";
import Login from "./Login";
import AuthCallback from "./AuthCallback";
import Dashboard from "./Dashboard";
import Banking from "./Banking";
import Budgeting from "./Budgeting";
import NetWorth from "./NetWorth";
import CreditScore from "./CreditScore";
import Contacts from "./Contacts";
import ContactDetail from "./ContactDetail";
import AccountDetail from "./AccountDetail";
import Settings from "./Settings";
import Goals from "./Goals";
import Calendar from "./Calendar";
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const PAGES = {

    Dashboard: Dashboard,

    Banking: Banking,

    Budgeting: Budgeting,

    Goals: Goals,

    Calendar: Calendar,

    NetWorth: NetWorth,

    CreditScore: CreditScore,

    Contacts: Contacts,

    Settings: Settings,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    const isAuthRoute = location.pathname === '/login' || location.pathname === '/auth/callback';

    if (isAuthRoute) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
            </Routes>
        );
    }

    return (
        <ProtectedRoute>
            <Layout currentPageName={currentPage}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/Dashboard" element={<Dashboard />} />
                    <Route path="/Banking" element={<Banking />} />
                    <Route path="/Banking/account/:id" element={<AccountDetail />} />
                    <Route path="/Budgeting" element={<Budgeting />} />
                    <Route path="/Goals" element={<Goals />} />
                    <Route path="/Calendar" element={<Calendar />} />
                    <Route path="/NetWorth" element={<NetWorth />} />
                    <Route path="/CreditScore" element={<CreditScore />} />
                    <Route path="/Contacts" element={<Contacts />} />
                    <Route path="/Contacts/:id" element={<ContactDetail />} />
                    <Route path="/Rules" element={<Navigate to="/Banking?tab=rules" replace />} />
                    <Route path="/Settings" element={<Settings />} />
                </Routes>
            </Layout>
        </ProtectedRoute>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}