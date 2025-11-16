import React, { useState } from 'react';

/**
 * Tab configuration interface
 */
export interface TabConfig {
  /**
   * Unique identifier for the tab
   */
  id: string;

  /**
   * Display label for the tab
   */
  label: string;

  /**
   * Optional icon component for the tab
   */
  icon?: React.ReactNode;

  /**
   * Optional badge/count to display on the tab
   */
  badge?: string | number;

  /**
   * Whether the tab is disabled
   */
  disabled?: boolean;
}

/**
 * Props for the TabLayout component
 */
export interface TabLayoutProps {
  /**
   * Array of tab configurations
   */
  tabs: TabConfig[];

  /**
   * Currently active tab ID
   */
  activeTab: string;

  /**
   * Callback when a tab is selected
   */
  onTabChange: (tabId: string) => void;

  /**
   * Tab content to render for each tab
   */
  children: React.ReactNode;

  /**
   * Layout variant - 'horizontal' or 'vertical'
   */
  variant?: 'horizontal' | 'vertical';

  /**
   * Size variant for tabs
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * Additional CSS classes for the tabs container
   */
  tabsClassName?: string;

  /**
   * Additional CSS classes for the content container
   */
  contentClassName?: string;
}

/**
 * TabLayout component - provides a flexible tabbed interface layout.
 *
 * This component handles tab navigation and content switching with support
 * for icons, badges, and different layout variants.
 *
 * @example
 * ```tsx
 * <TabLayout
 *   tabs={[
 *     { id: 'overview', label: 'Overview', icon: <BarChart3 /> },
 *     { id: 'settings', label: 'Settings', icon: <Settings />, badge: '3' }
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * >
 *   {activeTab === 'overview' && <OverviewTab />}
 *   {activeTab === 'settings' && <SettingsTab />}
 * </TabLayout>
 * ```
 */
export const TabLayout: React.FC<TabLayoutProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children,
  variant = 'horizontal',
  size = 'md',
  className = '',
  tabsClassName = '',
  contentClassName = '',
}) => {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const sizeClasses = {
    sm: {
      tab: 'px-3 py-2 text-sm',
      icon: 'w-4 h-4',
      badge: 'text-xs px-1.5 py-0.5',
    },
    md: {
      tab: 'px-4 py-3 text-sm',
      icon: 'w-5 h-5',
      badge: 'text-xs px-2 py-1',
    },
    lg: {
      tab: 'px-6 py-4 text-base',
      icon: 'w-6 h-6',
      badge: 'text-sm px-2.5 py-1',
    },
  };

  const currentSize = sizeClasses[size];

  if (variant === 'vertical') {
    return (
      <div className={`flex ${className}`}>
        {/* Vertical Tabs Sidebar */}
        <div className={`w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col ${tabsClassName}`}>
          <div className="flex-1 py-4">
            <div className="space-y-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const isHovered = hoveredTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && onTabChange(tab.id)}
                    onMouseEnter={() => setHoveredTab(tab.id)}
                    onMouseLeave={() => setHoveredTab(null)}
                    disabled={tab.disabled}
                    className={`
                      w-full flex items-center space-x-3 ${currentSize.tab} rounded-lg mx-2 transition-all duration-200
                      ${isActive
                        ? 'bg-[var(--color-active)] text-[var(--color-text)] shadow-lg'
                        : tab.disabled
                          ? 'text-[var(--color-text-muted)] cursor-not-allowed opacity-50'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                      }
                    `}
                    aria-pressed={isActive}
                    aria-disabled={tab.disabled}
                  >
                    {/* Icon */}
                    {tab.icon && (
                      <div className={`${currentSize.icon} flex-shrink-0 ${isActive ? 'text-[var(--color-primary)]' : ''}`}>
                        {tab.icon}
                      </div>
                    )}

                    {/* Label */}
                    <span className="font-medium flex-1 text-left">{tab.label}</span>

                    {/* Badge */}
                    {tab.badge && (
                      <span className={`
                        ${currentSize.badge} rounded-full font-bold flex-shrink-0
                        ${isActive
                          ? 'bg-[var(--color-primary)] text-[var(--color-background)]'
                          : 'bg-[var(--color-error)] text-white'
                        }
                      `}>
                        {tab.badge}
                      </span>
                    )}

                    {/* Active Indicator */}
                    {isActive && (
                      <div className="w-1 h-6 bg-[var(--color-primary)] rounded-full flex-shrink-0"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-hidden ${contentClassName}`}>
          {children}
        </div>
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Horizontal Tabs */}
      <div className={`bg-[var(--color-surface)] border-b border-[var(--color-border)] ${tabsClassName}`}>
        <div className="flex items-center space-x-1 px-6 py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isHovered = hoveredTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && onTabChange(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                disabled={tab.disabled}
                className={`
                  flex items-center space-x-2 ${currentSize.tab} rounded-lg transition-all duration-200 relative
                  ${isActive
                    ? 'bg-[var(--color-active)] text-[var(--color-text)] shadow-md'
                    : tab.disabled
                      ? 'text-[var(--color-text-muted)] cursor-not-allowed opacity-50'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                  }
                `}
                aria-pressed={isActive}
                aria-disabled={tab.disabled}
              >
                {/* Icon */}
                {tab.icon && (
                  <div className={`${currentSize.icon} ${isActive ? 'text-[var(--color-primary)]' : ''}`}>
                    {tab.icon}
                  </div>
                )}

                {/* Label */}
                <span className="font-medium">{tab.label}</span>

                {/* Badge */}
                {tab.badge && (
                  <span className={`
                    ${currentSize.badge} rounded-full font-bold ml-1
                    ${isActive
                      ? 'bg-[var(--color-primary)] text-[var(--color-background)]'
                      : 'bg-[var(--color-error)] text-white'
                    }
                  `}>
                    {tab.badge}
                  </span>
                )}

                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[var(--color-primary)] rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-hidden ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default TabLayout;
