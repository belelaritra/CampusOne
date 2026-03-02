import { useState } from 'react';

/**
 * Reusable tab navigation component.
 * @param {Array}  tabs - [{ id, label }]
 * @param {string} defaultTab - initial active tab id
 * @param {Function} renderContent - (activeTab) => JSX
 */
export default function Tabs({ tabs, defaultTab, renderContent }) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);

  return (
    <>
      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${active === tab.id ? ' active' : ''}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        {renderContent(active)}
      </div>
    </>
  );
}
