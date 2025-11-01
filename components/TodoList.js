import React, { useState } from 'react';

const TodoList = ({ todos, onUpdateTodos }) => {
    const [newTodoText, setNewTodoText] = useState('');

    const handleAddTodo = () => {
        if (newTodoText.trim() === '') return;
        const newTodo = {
            id: Date.now().toString(),
            text: newTodoText.trim(),
            completed: false,
        };
        onUpdateTodos([...todos, newTodo]);
        setNewTodoText('');
    };

    const handleToggleTodo = (id) => {
        const updatedTodos = todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
        );
        onUpdateTodos(updatedTodos);
    };

    const handleDeleteTodo = (id) => {
        const updatedTodos = todos.filter(todo => todo.id !== id);
        onUpdateTodos(updatedTodos);
    };

    return React.createElement('div', { className: "mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700" },
        React.createElement('h3', { className: "text-lg font-semibold text-slate-300 mb-3 text-left" }, "To-Do List"),
        React.createElement('div', { className: "space-y-2" },
            todos.map(todo =>
                React.createElement('div', { key: todo.id, className: "flex items-center justify-between gap-2 p-2 rounded-md hover:bg-slate-800/50" },
                    React.createElement('label', { className: `flex-1 flex items-center gap-3 cursor-pointer ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-200'}` },
                        React.createElement('input', {
                            type: "checkbox",
                            checked: todo.completed,
                            onChange: () => handleToggleTodo(todo.id),
                            className: "h-5 w-5 rounded bg-slate-700 border-slate-500 text-cyan-500 focus:ring-cyan-500"
                        }),
                        React.createElement('span', null, todo.text)
                    ),
                    React.createElement('button', {
                        onClick: () => handleDeleteTodo(todo.id),
                        className: "text-slate-500 hover:text-red-400 p-1",
                        'aria-label': `Delete todo: ${todo.text}`
                    },
                        React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
                            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" })
                        )
                    )
                )
            )
        ),
        React.createElement('div', { className: "mt-4 flex gap-2" },
            React.createElement('input', {
                type: "text",
                value: newTodoText,
                onChange: (e) => setNewTodoText(e.target.value),
                onKeyPress: (e) => e.key === 'Enter' && handleAddTodo(),
                placeholder: "Add a new task...",
                className: "flex-grow bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 transition"
            }),
            React.createElement('button', {
                onClick: handleAddTodo,
                className: "bg-cyan-500 text-slate-900 font-bold py-2 px-3 rounded-lg hover:bg-cyan-400 text-sm"
            }, "Add")
        )
    );
};

export default TodoList;
