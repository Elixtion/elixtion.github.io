import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Search, Menu, X } from 'lucide-react';

const DataInsightsDashboard = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNavClick = (page) => {
    alert(`Navigating to ${page} page`);
  };

  const handleGetStarted = () => {
    alert('Getting started with Data Insights!');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      alert(`Searching for: ${searchQuery}`);
    }
  };

  const features = [
    {
      icon: BarChart3,
      title: "Interactive Dashboards",
      description: "Create dynamic and customizable dashboards to track key metrics and trends in real-time."
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Collaborate seamlessly with your team, share insights, and work together to achieve your goals."
    },
    {
      icon: Search,
      title: "Advanced Search",
      description: "Quickly find specific data points and trends with our powerful search functionality."
    }
  ];

  const visualizations = [
    {
      title: "Customizable Charts",
      description: "Choose from a variety of chart types and customize them to match your brand and reporting needs.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop"
    },
    {
      title: "Data Exploration",
      description: "Dive deep into your data with interactive exploration tools that allow you to uncover hidden patterns.",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop"
    },
    {
      title: "Reporting & Sharing",
      description: "Generate reports and share your insights with stakeholders in a clear and concise format.",
      image: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=300&fit=crop"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500 p-2">
                <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white">Data Insights</h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-8 md:flex">
              <button 
                onClick={() => handleNavClick('Teams')}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                Teams
              </button>
              <button 
                onClick={() => handleNavClick('Events')}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                Events
              </button>
              <button 
                onClick={() => handleNavClick('Matches')}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                Matches
              </button>
            </nav>

            {/* Search and Profile */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
                    placeholder="Search"
                    className="h-10 w-64 rounded-lg border border-slate-700 bg-slate-800 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              
              <button className="h-10 w-10 overflow-hidden rounded-full border-2 border-slate-700 transition-transform hover:scale-110">
                <img 
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face" 
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              </button>

              {/* Mobile menu button */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <nav className="mt-4 flex flex-col gap-4 border-t border-slate-800 pt-4 md:hidden">
              <button 
                onClick={() => handleNavClick('Teams')}
                className="text-left text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                Teams
              </button>
              <button 
                onClick={() => handleNavClick('Events')}
                className="text-left text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                Events
              </button>
              <button 
                onClick={() => handleNavClick('Matches')}
                className="text-left text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                Matches
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative">
          <div className="relative h-[600px] overflow-hidden rounded-none">
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: 'url("https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop")'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
            
            <div className="relative z-10 flex h-full items-end">
              <div className="mx-auto max-w-7xl px-6 pb-16">
                <div className="max-w-4xl">
                  <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-white md:text-7xl">
                    Unlock the Power of Data Insights
                  </h1>
                  <p className="mb-8 max-w-2xl text-lg text-slate-300 md:text-xl">
                    Transform raw data into actionable intelligence with our intuitive analytics platform. 
                    Gain a competitive edge by understanding your audience, optimizing your strategies, and driving growth.
                  </p>
                  <button 
                    onClick={handleGetStarted}
                    className="inline-flex h-12 items-center justify-center rounded-lg bg-emerald-500 px-8 text-base font-bold text-slate-900 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/40"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-5xl font-extrabold tracking-tight text-white">Key Features</h2>
              <p className="mx-auto max-w-2xl text-lg text-slate-400">
                Our platform offers a comprehensive suite of tools to analyze and visualize your data effectively.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="group rounded-xl border border-slate-800 bg-gradient-to-br from-slate-800 to-slate-900 p-6 transition-all duration-300 hover:border-emerald-600 hover:shadow-2xl hover:shadow-emerald-900/50 cursor-pointer"
                  onMouseEnter={() => setHoveredFeature(index)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  onClick={() => alert(`Exploring ${feature.title} feature`)}
                >
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-300 ${
                    hoveredFeature === index 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-emerald-900 text-emerald-300'
                  }`}>
                    <feature.icon size={24} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold text-white">{feature.title}</h3>
                    <p className="text-slate-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Visualizations Section */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-5xl font-extrabold tracking-tight text-white">Visualize Your Data</h2>
              <p className="mx-auto max-w-2xl text-lg text-slate-400">
                Transform complex data into clear and compelling visualizations that tell a story.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {visualizations.map((viz, index) => (
                <div 
                  key={index}
                  className="group cursor-pointer"
                  onClick={() => alert(`Opening ${viz.title} tool`)}
                >
                  <div className="mb-4 overflow-hidden rounded-lg border border-slate-800 transition-all duration-300 group-hover:border-emerald-600 group-hover:shadow-2xl group-hover:shadow-emerald-800/40">
                    <img 
                      src={viz.image}
                      alt={viz.title}
                      className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold text-white">{viz.title}</h3>
                    <p className="text-slate-400">{viz.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500 p-1">
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span className="text-lg font-semibold text-white">Data Insights</span>
              </div>
              <p className="text-slate-500">© 2024 Data Insights. All rights reserved.</p>
            </div>

            <div className="flex items-center gap-8">
              <nav className="flex gap-6">
                <button 
                  onClick={() => alert('Opening Terms page')}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-emerald-500"
                >
                  Terms
                </button>
                <button 
                  onClick={() => alert('Opening Privacy page')}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-emerald-500"
                >
                  Privacy
                </button>
                <button 
                  onClick={() => alert('Opening Contact page')}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-emerald-500"
                >
                  Contact
                </button>
              </nav>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => alert('Opening Twitter profile')}
                  className="text-slate-500 transition-colors hover:text-emerald-500"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.71v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/>
                  </svg>
                </button>
                <button 
                  onClick={() => alert('Opening LinkedIn profile')}
                  className="text-slate-500 transition-colors hover:text-emerald-500"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DataInsightsDashboard;