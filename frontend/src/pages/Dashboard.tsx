import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar.js';
import { Header } from '../components/Header.js';
import { StatsCards } from '../components/StatsCards.js';
import { ScheduledTable } from '../components/ScheduledTable.js';
import { SentTable } from '../components/SentTable.js';
import { SendersModal } from '../components/SendersModal.js';
import { SlackModal } from '../components/SlackModal.js';
import { ComposeModal } from '../components/ComposeModal.js';
import { useSearchEmails } from '../services/apiService.js';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'senders' | 'slack'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Full-text search with Elasticsearch or DB fallback
  const { data: searchResults, isFetching: isSearching } = useSearchEmails(searchQuery);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'scheduled':
        return 'Scheduled Queue';
      case 'sent':
        return 'Delivered Emails';
      case 'senders':
        return 'Sender Accounts';
      case 'slack':
        return 'Slack Integrations';
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
        }}
        onOpenCompose={() => setIsComposeOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={getPageTitle()}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenCompose={() => setIsComposeOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Dashboard Metrics Cards */}
          <StatsCards />

          {/* Search Result Banner */}
          {searchQuery.trim().length > 0 && (
            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200/60 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
              <span>
                Search results for: <strong>"{searchQuery}"</strong>{' '}
                {isSearching ? '(searching...)' : `(${searchResults?.total ?? 0} found via Elasticsearch)`}
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'scheduled' && (
            <ScheduledTable
              searchResults={searchQuery.trim() ? searchResults?.items : null}
            />
          )}

          {activeTab === 'sent' && (
            <SentTable
              searchResults={searchQuery.trim() ? searchResults?.items : null}
            />
          )}

          {activeTab === 'senders' && <SendersModal />}

          {activeTab === 'slack' && <SlackModal />}
        </main>
      </div>

      {/* Compose & Schedule Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          // Switch to scheduled tab on new scheduling
          setActiveTab('scheduled');
        }}
      />
    </div>
  );
};
