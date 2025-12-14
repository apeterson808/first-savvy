import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Transactions from "./Transactions";

import Banking from "./Banking";

import Budgeting from "./Budgeting";

import NetWorth from "./NetWorth";

import CreditScore from "./CreditScore";

import ConnectAccount from "./ConnectAccount";

import Contacts from "./Contacts";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Transactions: Transactions,
    
    Banking: Banking,
    
    Budgeting: Budgeting,
    
    NetWorth: NetWorth,
    
    CreditScore: CreditScore,
    
    ConnectAccount: ConnectAccount,
    
    Contacts: Contacts,
    
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
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Transactions" element={<Transactions />} />
                
                <Route path="/Banking" element={<Banking />} />
                
                <Route path="/Budgeting" element={<Budgeting />} />
                
                <Route path="/NetWorth" element={<NetWorth />} />
                
                <Route path="/CreditScore" element={<CreditScore />} />
                
                <Route path="/ConnectAccount" element={<ConnectAccount />} />
                
                <Route path="/Contacts" element={<Contacts />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}