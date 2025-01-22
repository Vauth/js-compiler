// Editor Setup
const editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
    lineNumbers: true,
    mode: 'javascript',
    theme: 'material-darker',
    indentUnit: 2,
    tabSize: 2,
    matchBrackets: true,
    autoCloseBrackets: true,
    scrollPastEnd: true,
    viewportMargin: Infinity,
    extraKeys: {
        "Ctrl-Space": "autocomplete",
        "Ctrl-Enter": executeCode,
        "Ctrl-S": saveFile,
        "Cmd-S": saveFile
    }
});

// Initialize editor
editor.setValue(localStorage.getItem('savedCode') || '// Write your JavaScript code here\nconsole.log("Hello World!");\n');

// Execution logic
let originalConsole = {};
let isExecuting = false;

async function executeCode() {
    isExecuting = true;
    const outputElement = document.getElementById('output');
    outputElement.innerHTML = '';
    
    const errorHandler = (ev) => {
        const error = ev.error || ev.reason;
        if (error) {
            handleError(error);
        }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', errorHandler);

    try {
        const code = editor.getValue();
        localStorage.setItem('savedCode', code);

        // Backup console
        originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn
        };

        // Capture console
        console.log = createOutput('log');
        console.error = createOutput('error');
        console.warn = createOutput('warn');

        // Transform and execute with source line retention
        const transformed = Babel.transform(code, { 
            presets: ['env'],
            filename: 'script.js',
            retainLines: true,
            sourceMaps: 'inline'
        }).code;

        const result = new Function(transformed)();
        
        if (result instanceof Promise) {
            await result;
        }
        
    } catch(error) {
        handleError(error);
    } finally {
        setTimeout(() => {
            Object.assign(console, originalConsole);
            window.removeEventListener('error', errorHandler);
            window.removeEventListener('unhandledrejection', errorHandler);
            isExecuting = false;
        }, 100);
    }
}

function handleError(error) {
    let message = error.message;
    const babelPrefix = 'unknown: ';
    
    if (message.startsWith(babelPrefix)) {
        message = message.slice(babelPrefix.length);
        message = message.replace(/\((\d+):(\d+)\)/g, '(line $1, column $2)');
    }

    const stack = error.stack ? error.stack
        .split('\n')
        .filter(line => !line.includes('babel.min.js'))
        .map(line => line.replace(/^at/, '<br>at'))
        .join('\n')
        : '';

    createOutput('error')({ 
        message: `Error: ${message}`,
        stack: stack || `    at ${error.stack || 'unknown source'}`
    });
}

function createOutput(type) {
    return (...args) => {
        if (!isExecuting) return;
        
        const outputElement = document.getElementById('output');
        const messages = args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || arg.toString();
            }
            if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
            }
            return arg.toString();
        });

        messages.forEach(message => {
            const line = document.createElement('div');
            line.className = type;
            line.innerHTML = message.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
            outputElement.appendChild(line);
        });
    };
}

function saveFile() {
    const code = editor.getValue();
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script.js';
    a.click();
    
    URL.revokeObjectURL(url);
}

editor.on('change', () => {
    if(document.getElementById('autoRun').checked) {
        debounce(executeCode, 500)();
    }
});

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
});

// Hide loader when all resources are loaded
window.addEventListener('load', () => {
    const loader = document.querySelector('.loader');
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 300); // Remove after fade-out
});