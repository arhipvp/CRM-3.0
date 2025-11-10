import React, { useState, useMemo } from 'react';
import { Deal, Client, Task, Policy } from '../../types';

interface TasksViewProps {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
}

interface EnrichedTask extends Task {
    dealTitle: string;
    clientName: string;
}

const RENEWAL_REMINDER_DAYS = 30;

const TaskCard: React.FC<{ task: EnrichedTask }> = ({ task }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-start space-x-4">
        <input type="checkbox" defaultChecked={task.completed} className="h-5 w-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 mt-1" />
        <div className="flex-1">
            <p className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.description}</p>
            <div className="text-sm text-slate-500 mt-1">
                {task.dealTitle !== "Продление полиса" && 
                  <>
                    <span>Сделка: </span>
                    <span className="font-semibold text-sky-700">{task.dealTitle}</span>
                    <span className="mx-2">&middot;</span>
                  </>
                }
                <span>{task.clientName}</span>
            </div>
             <div className="text-xs text-slate-400 mt-2 flex items-center space-x-4">
                <span className={`font-bold px-2 py-0.5 rounded-full ${task.assignee.includes('Продавец') ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{task.assignee}</span>
                <span>Срок: {task.dueDate}</span>
            </div>
        </div>
    </div>
);

export const TasksView: React.FC<TasksViewProps> = ({ deals, clients, policies }) => {
    const [filters, setFilters] = useState({ assignee: 'all', clientName: '' });
    const [sortBy, setSortBy] = useState('dueDate-asc');

    const combinedTasks = useMemo<EnrichedTask[]>(() => {
        // Generate renewal reminders from policies
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reminderLimit = new Date(today);
        reminderLimit.setDate(today.getDate() + RENEWAL_REMINDER_DAYS);

        const renewalReminders = policies
            .filter(policy => {
                const endDate = new Date(policy.endDate);
                return endDate >= today && endDate <= reminderLimit;
            })
            .map(policy => ({
                id: `reminder-${policy.id}`,
                description: `Подготовить продление полиса №${policy.policyNumber}`,
                completed: false,
                assignee: deals.find(d => d.id === policy.dealId)?.owner || 'Не назначен',
                dueDate: policy.endDate,
                dealTitle: 'Продление полиса',
                clientName: clients.find(c => c.id === policy.clientId)?.name || 'N/A'
            }));

        // Get tasks from deals
        const dealTasks: EnrichedTask[] = deals.flatMap(deal =>
            deal.tasks.map(task => ({
                ...task,
                dealTitle: deal.title,
                clientName: clients.find(c => c.id === deal.clientId)?.name || 'N/A'
            }))
        );

        return [...renewalReminders, ...dealTasks];
    }, [deals, clients, policies]);
    
    const uniqueAssignees = useMemo(() => [...new Set(combinedTasks.map(t => t.assignee))].sort(), [combinedTasks]);

    const filteredAndSortedTasks = useMemo(() => {
        let processedTasks = [...combinedTasks];
        
        processedTasks = processedTasks.filter(t =>
            (filters.assignee === 'all' || t.assignee === filters.assignee) &&
            t.clientName.toLowerCase().includes(filters.clientName.toLowerCase().trim())
        );

        processedTasks.sort((a, b) => {
            switch (sortBy) {
                case 'dueDate-asc':
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                case 'dueDate-desc':
                    return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
                case 'assignee':
                    return a.assignee.localeCompare(b.assignee);
                case 'clientName':
                    return a.clientName.localeCompare(b.clientName);
                default:
                    return 0;
            }
        });

        return processedTasks;
    }, [combinedTasks, filters, sortBy]);

    const renewalReminders = filteredAndSortedTasks.filter(t => t.dealTitle === 'Продление полиса');
    const activeTasks = filteredAndSortedTasks.filter(t => t.dealTitle !== 'Продление полиса' && !t.completed);
    const completedTasks = filteredAndSortedTasks.filter(t => t.completed);

    return (
        <div className="p-8 overflow-y-auto h-full">
            <h1 className="text-3xl font-bold text-slate-800 mb-6">Все задачи ({filteredAndSortedTasks.length})</h1>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label htmlFor="client-filter" className="block text-sm font-medium text-slate-600 mb-1">Клиент</label>
                    <input 
                        id="client-filter"
                        type="text"
                        placeholder="Поиск по клиенту..."
                        value={filters.clientName}
                        onChange={e => setFilters(prev => ({...prev, clientName: e.target.value}))}
                        className="w-full text-sm p-2 border border-slate-300 rounded-md"
                    />
                </div>
                <div>
                    <label htmlFor="assignee-filter" className="block text-sm font-medium text-slate-600 mb-1">Ответственный</label>
                    <select 
                        id="assignee-filter"
                        value={filters.assignee}
                        onChange={e => setFilters(prev => ({...prev, assignee: e.target.value}))}
                        className="w-full text-sm p-2 border border-slate-300 rounded-md bg-white"
                    >
                        <option value="all">Все</option>
                        {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="sort-by" className="block text-sm font-medium text-slate-600 mb-1">Сортировать по</label>
                    <select 
                        id="sort-by"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="w-full text-sm p-2 border border-slate-300 rounded-md bg-white"
                    >
                        <option value="dueDate-asc">Сроку (сначала ближайшие)</option>
                        <option value="dueDate-desc">Сроку (сначала дальние)</option>
                        <option value="assignee">Ответственному</option>
                        <option value="clientName">Клиенту</option>
                    </select>
                </div>
            </div>

            <div className="space-y-8">
                 <div>
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Напоминания о продлении ({renewalReminders.length})</h2>
                    <div className="space-y-3">
                        {renewalReminders.length > 0 ? renewalReminders.map(task => <TaskCard key={task.id} task={task} />) : <p className="text-slate-500">Нет предстоящих продлений, соответствующих фильтрам.</p>}
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Активные ({activeTasks.length})</h2>
                    <div className="space-y-3">
                        {activeTasks.length > 0 ? activeTasks.map(task => <TaskCard key={task.id} task={task} />) : <p className="text-slate-500">Нет активных задач, соответствующих фильтрам.</p>}
                    </div>
                </div>
                 <div>
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Выполненные ({completedTasks.length})</h2>
                    <div className="space-y-3">
                         {completedTasks.length > 0 ? completedTasks.map(task => <TaskCard key={task.id} task={task} />) : <p className="text-slate-500">Нет выполненных задач, соответствующих фильтрам.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
