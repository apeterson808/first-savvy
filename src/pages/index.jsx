import Layout from "./Layout.jsx";
import Login from "./Login";
import AuthCallback from "./AuthCallback";
import Dashboard from "./Dashboard";
import Banking from "./Banking";
import Budgeting from "./Budgeting";
import NetWorth from "./NetWorth";
import Investments from "./Investments";
import CreditScore from "./CreditScore";
import Contacts from "./Contacts";
import ContactDetail from "./ContactDetail";
import AccountDetail from "./AccountDetail";
import ExpenseCategoryDetail from "./ExpenseCategoryDetail";
import Settings from "./Settings";
import Goals from "./Goals";
import Calendar from "./Calendar";
import PasswordVault from "./PasswordVault";
import Integrations from "./Integrations";
import Affiliate from "./Affiliate";
import Connections from "./Connections";
import ConnectionDetail from "./ConnectionDetail";
import ClaimProfile from "./ClaimProfile";
import ChildProfileSelector from "@/components/children/ChildProfileSelector";
import { Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const PAGES = {

    Dashboard: Dashboard,

    Banking: Banking,

    Budgeting: Budgeting,

    Goals: Goals,

    Calendar: Calendar,

    NetWorth: NetWorth,

    Investments: Investments,

    CreditScore: CreditScore,

    Contacts: Contacts,

    Connections: Connections,

    Integrations: Integrations,

    PasswordVault: PasswordVault,

    Affiliate: Affiliate,

    Settings: Settings,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    const pathParts = url.split('/').filter(Boolean);

    if (pathParts.length === 0) {
        return 'Dashboard';
    }

    const firstPart = pathParts[0];
    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === firstPart.toLowerCase());

    return pageName || Object.keys(PAGES)[0];
}

export default function Pages() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    const isAuthRoute = location.pathname === '/login' ||
                        location.pathname === '/auth/callback' ||
                        location.pathname.startsWith('/invite/') ||
                        location.pathname === '/select-child-profile';

    if (isAuthRoute) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/invite/:token" element={<ClaimProfile />} />
                <Route path="/select-child-profile" element={<ChildProfileSelector />} />
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
                    <Route path="/Budgeting/category/:id" element={<AccountDetail />} />
                    <Route path="/Goals" element={<Goals />} />
                    <Route path="/Calendar" element={<Calendar />} />
                    <Route path="/NetWorth" element={<NetWorth />} />
                    <Route path="/Investments" element={<Investments />} />
                    <Route path="/CreditScore" element={<CreditScore />} />
                    <Route path="/Contacts" element={<Contacts />} />
                    <Route path="/Contacts/:id" element={<ContactDetail />} />
                    <Route path="/Connections" element={<Connections />} />
                    <Route path="/Connections/:id" element={<ConnectionDetail />} />
                    <Route path="/Integrations" element={<Integrations />} />
                    <Route path="/PasswordVault" element={<PasswordVault />} />
                    <Route path="/Affiliate" element={<Affiliate />} />
                    <Route path="/Rules" element={<Navigate to="/Banking?tab=rules" replace />} />
                    <Route path="/Settings" element={<Settings />} />
                </Routes>
            </Layout>
        </ProtectedRoute>
    );
}