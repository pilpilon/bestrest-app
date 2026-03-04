import { useEffect } from 'react';

declare global {
    interface Window {
        WebMCP: any;
    }
}

interface WebMCPProps {
    expenses: any[];
}

export function WebMCPIntegration({ expenses }: WebMCPProps) {
    useEffect(() => {
        if (typeof window.WebMCP !== 'undefined') {
            try {
                const mcp = new window.WebMCP({
                    color: '#10B981', // BestRest emerald green
                    position: 'bottom-right',
                });

                console.log('[WebMCP] Initializing Native Integration for BestRest');

                // 1. Tool: Navigate through the App
                mcp.registerTool(
                    'navigate_to_feature',
                    'Navigate to different sections of the application',
                    {
                        route: { type: 'string', description: 'Route path (e.g., /dashboard, /inventory, /cookbook, /reports)' },
                    },
                    (args: { route: string }) => {
                        window.history.pushState({}, '', args.route);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        return {
                            content: [{ type: 'text', text: `Navigated successfully to ${args.route}` }],
                        };
                    }
                );

                // 2. Tool: Get Dashboard Summary
                mcp.registerTool(
                    'get_dashboard_summary',
                    'Get a summary of total expenses and recent scanned receipts',
                    {},
                    () => {
                        const totalReceipts = expenses.length;
                        const recentActivity = expenses.slice(0, 3).map((r: any) => r.supplier).join(', ');

                        return {
                            content: [{
                                type: 'text',
                                text: `Total Receipts Scanned: ${totalReceipts}\nRecent Vendors: ${recentActivity || 'None yet'}`
                            }],
                        };
                    }
                );

            } catch (err) {
                console.error('[WebMCP] Failed to initialize', err);
            }
        }
    }, [expenses]);

    return null; // Headless component
}
