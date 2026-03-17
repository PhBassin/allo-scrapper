import React, { useState, useEffect, useCallback } from 'react';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, type CreateSchedulePayload, type UpdateSchedulePayload } from '../../api/client';
import type { ScrapeSchedule } from '../../types';
import ScheduleModal from '../../components/admin/ScheduleModal';
import { AuthContext } from '../../contexts/AuthContext';
import { useContext } from 'react';

const SchedulesPage: React.FC = () => {
  const { hasPermission } = useContext(AuthContext);
  const [schedules, setSchedules] = useState<ScrapeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScrapeSchedule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const canCreate = hasPermission('scraper:schedules:create');
  const canUpdate = hasPermission('scraper:schedules:update');
  const canDelete = hasPermission('scraper:schedules:delete');

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSchedules();
      setSchedules(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleCreate = async (data: CreateSchedulePayload) => {
    await createSchedule(data);
    await fetchSchedules();
  };

  const handleUpdate = async (data: CreateSchedulePayload | UpdateSchedulePayload) => {
    if (!editingSchedule) return;
    await updateSchedule(editingSchedule.id, data);
    await fetchSchedules();
  };

  const handleDelete = async (id: number) => {
    await deleteSchedule(id);
    setDeleteConfirm(null);
    await fetchSchedules();
  };

  const openCreateModal = () => {
    setEditingSchedule(null);
    setModalOpen(true);
  };

  const openEditModal = (schedule: ScrapeSchedule) => {
    setEditingSchedule(schedule);
    setModalOpen(true);
  };

  const formatCron = (cron: string): string => {
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;
    const [minute, hour, day, month, weekday] = parts;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let desc = '';
    if (minute === '0' && hour === '*') desc = 'Every hour';
    else if (minute.startsWith('*/')) desc = `Every ${minute.slice(2)} minutes`;
    else if (hour.startsWith('*/')) desc = `Every ${hour.slice(2)} hours`;
    else if (minute !== '*' && hour !== '*') desc = `At ${hour}:${minute.padStart(2, '0')}`;
    
    if (weekday !== '*') desc += ` on ${days[parseInt(weekday)]}`;
    if (day !== '*') desc += ` on day ${day}`;
    if (month !== '*') desc += ` in ${months[parseInt(month) - 1]}`;
    
    return desc || cron;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading schedules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
        <button onClick={fetchSchedules} className="mt-2 text-sm text-red-700 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scrape Schedules</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-yellow-500 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Schedule
          </button>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No schedules configured yet.</p>
          {canCreate && (
            <button
              onClick={openCreateModal}
              className="text-primary hover:underline"
            >
              Create your first schedule
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {schedule.name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          schedule.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {schedule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    {schedule.description && (
                      <p className="mt-1 text-sm text-gray-500">{schedule.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {schedule.cron_expression}
                      </span>
                      <span>{formatCron(schedule.cron_expression)}</span>
                    </div>
                    {schedule.last_run_at && (
                      <p className="mt-1 text-xs text-gray-400">
                        Last run: {new Date(schedule.last_run_at).toLocaleString()}
                        {schedule.last_run_status && (
                          <span className={`ml-2 ${
                            schedule.last_run_status === 'success' ? 'text-green-600' :
                            schedule.last_run_status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            ({schedule.last_run_status})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {(canUpdate || canDelete) && (
                      <div className="flex gap-2">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(schedule)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          deleteConfirm === schedule.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(schedule.id)}
                                className="p-2 text-red-600 hover:text-red-800"
                                title="Confirm delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="p-2 text-gray-400 hover:text-gray-600"
                                title="Cancel"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(schedule.id)}
                              className="p-2 text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ScheduleModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSchedule(null);
        }}
        onSave={async (data) => {
          if (editingSchedule) {
            await handleUpdate(data);
          } else {
            await handleCreate(data);
          }
        }}
        schedule={editingSchedule}
      />
    </div>
  );
};

export default SchedulesPage;
