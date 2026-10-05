"use client";

import React, { useState } from 'react';
import { Calendar, CheckCircle2, Clock, Plus, Search } from 'lucide-react';

export default function AcademicYearsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Academic Years</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure academic sessions and active term periods</p>
        </div>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          New Academic Year
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Search academic years..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No Academic Years Defined</h3>
          <p className="text-sm">Please configure at least one active academic year to start using the system.</p>
        </div>
      </div>
    </div>
  );
}
