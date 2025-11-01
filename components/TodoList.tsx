import React, { useState } from 'react';
import { TodoItem } from '../types';

interface TodoListProps {
    todos: TodoItem[];
    onUpdateTodos: (newTodos: TodoItem[]) => void;
}

const TodoList: React.FC<TodoListProps> = ({ todos, onUpdateTodos }) => {
    const [newTodoText, setNewTodoText] = useState('');

    const handleAddTodo = () => {
        if (newTodoText.trim() === '') return;
        const newTodo: TodoItem = {
            id: Date.now().toString(),
            text: newTodoText.trim(),
            completed: false,
        };
        onUpdateTodos([...todos, newTodo]);
        setNewTodoText('');
    };

    const handleToggleTodo = (id: string) => {
        const updatedTodos = todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
        );
        onUpdateTodos(updatedTodos);
    };

    const handleDeleteTodo = (id: string) => {
        const updatedTodos = todos.filter(todo => todo.id !== id);
        onUpdateTodos(updatedTodos);
    };

    return (
        <div className="mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-slate-300 mb-3 text-left">To-Do List</h3>
            <div className="space-y-2">
                {todos.map(todo => (
                    <div key={todo.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-slate-800/50">
                        <label className={`flex-1 flex items-center gap-3 cursor-pointer ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                            <input
                                type="checkbox"
                                checked={todo.completed}
                                onChange={() => handleToggleTodo(todo.id)}
                                className="h-5 w-5 rounded bg-slate-700 border-slate-500 text-cyan-500 focus:ring-cyan-500"
                            />
                            <span>{todo.text}</span>
                        </label>
                        <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="text-slate-500 hover:text-red-400 p-1"
                            aria-label={`Delete todo: ${todo.text}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                    placeholder="Add a new task..."
                    className="form-input flex-grow rounded-lg p-2 text-sm text-slate-200 placeholder-slate-500 transition"
                />
                <button
                    onClick={handleAddTodo}
                    className="bg-cyan-500 text-slate-900 font-bold py-2 px-3 rounded-lg hover:bg-cyan-400 text-sm button-glow-cyan"
                >
                    Add
                </button>
            </div>
        </div>
    );
};

export default TodoList;
