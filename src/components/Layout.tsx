import React from 'react';
import { appWindow } from '@tauri-apps/api/window';
import Sidebar from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
    currentView: string;
    onChangeView: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView }) => {
    return (
        <div className="flex w-full h-screen bg-bg-dark overflow-hidden text-white font-sans selection:bg-gold-primary selection:text-black">
            <Sidebar currentView={currentView} onChangeView={onChangeView} />
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Top Bar / Drag Region */}
                <div data-tauri-drag-region className="h-8 w-full shrink-0 flex justify-end items-center px-2 z-50 bg-transparent">
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => appWindow.minimize()}
                            className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Minimize"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        <button 
                            onClick={() => appWindow.close()}
                            className="p-2 text-gray-500 hover:text-white hover:bg-red-500/80 rounded transition-colors"
                            title="Close"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                
                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative z-10 scroll-smooth">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;
