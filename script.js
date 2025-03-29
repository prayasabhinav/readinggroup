// DOM elements
const topicForm = document.getElementById('topic-form');
const topicInput = document.getElementById('topic-input');
const topicList = document.getElementById('topic-list');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');
const adminPanel = document.getElementById('admin-panel');
const topicSelect = document.getElementById('topic-select');
const selectTopicBtn = document.getElementById('select-topic-btn');
const uploadPdfSection = document.getElementById('upload-pdf-section');
const userStats = document.getElementById('user-stats');
const votedCount = document.getElementById('voted-count');
const selectedCount = document.getElementById('selected-count');
const currentSelection = document.getElementById('current-selection');
const selectedTopicText = document.getElementById('selected-topic-text');
const selectedWeekDate = document.getElementById('selected-week-date');
const selectedPdfContainer = document.getElementById('selected-pdf-container');
const pdfUploadForm = document.getElementById('pdf-upload-form');
const pdfFileInput = document.getElementById('pdf-file');
const uploadStatus = document.getElementById('upload-status');
const clearAllBtn = document.getElementById('clear-all-btn');
const clearExceptSelectedBtn = document.getElementById('clear-except-selected-btn');
const proposedTopicsHeading = document.getElementById('proposed-topics-heading');

let currentUser = null;
let selectedTopicId = null;

// API URL base - use relative paths for flexibility in deployment
const API_BASE = '';

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/user`, {
            credentials: 'include'
        });
        if (response.ok) {
            currentUser = await response.json();
            updateUIForUser();
            fetchUserStats();
        } else {
            currentUser = null;
            updateUIForGuest();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        currentUser = null;
        updateUIForGuest();
    }
}

// Fetch user statistics
async function fetchUserStats() {
    try {
        const response = await fetch(`${API_BASE}/api/user/stats`, {
            credentials: 'include'
        });
        if (response.ok) {
            const stats = await response.json();
            votedCount.textContent = stats.totalVoted;
            selectedCount.textContent = stats.totalSelected;
            userStats.style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to fetch user stats:', error);
    }
}

// Update UI for logged-in user
function updateUIForUser() {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    userName.textContent = currentUser.name;
    topicForm.style.display = 'flex';
    
    if (currentUser.isAdmin) {
        adminPanel.style.display = 'block';
        loadTopicsForSelect();
    } else {
        adminPanel.style.display = 'none';
    }
}

// Update UI for guest
function updateUIForGuest() {
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    userName.textContent = '';
    topicForm.style.display = 'none';
    adminPanel.style.display = 'none';
    userStats.style.display = 'none';
    // Hide topics for logged out users
    topicList.innerHTML = '';
    proposedTopicsHeading.style.display = 'none';
    currentSelection.style.display = 'none';
}

// Load topics from server
async function loadTopics() {
    try {
        const response = await fetch(`${API_BASE}/api/topics`, {
            credentials: 'include'
        });
        const topics = await response.json();
        
        // Only show topics if the user is logged in
        if (!currentUser) {
            proposedTopicsHeading.style.display = 'none';
            topicList.innerHTML = '';
            return;
        }
        
        // Hide or show the proposed topics heading based on whether there are topics
        if (topics.length === 0) {
            proposedTopicsHeading.style.display = 'none';
        } else {
            proposedTopicsHeading.style.display = 'block';
        }
        
        renderTopics(topics);
        updateTopicSelect(topics);
        updateCurrentSelection(topics);
    } catch (error) {
        console.error('Failed to load topics:', error);
        // Hide the heading if there's an error loading topics
        proposedTopicsHeading.style.display = 'none';
    }
}

// Create PDF link element
function createPdfLink(pdfFile) {
    const link = document.createElement('a');
    link.href = `/uploads/${pdfFile.filename}`;
    link.className = 'pdf-link';
    link.target = '_blank';
    link.textContent = `View PDF: ${pdfFile.originalname}`;
    return link;
}

// Update current selection display
function updateCurrentSelection(topics) {
    // Don't show current selection for logged-out users
    if (!currentUser) {
        currentSelection.style.display = 'none';
        return;
    }
    
    const selectedTopic = topics.find(topic => topic.isSelected);
    
    if (selectedTopic) {
        selectedTopicText.textContent = selectedTopic.text;
        
        // Don't show week dates as requested
        selectedWeekDate.style.display = 'none';
        
        // Display PDF if available
        selectedPdfContainer.innerHTML = '';
        if (selectedTopic.pdfFile && selectedTopic.pdfFile.filename) {
            const pdfLink = createPdfLink(selectedTopic.pdfFile);
            selectedPdfContainer.appendChild(pdfLink);
            currentSelection.style.display = 'flex';
        } else if (currentUser && currentUser.isAdmin) {
            const noPdfMessage = document.createElement('p');
            noPdfMessage.textContent = 'No PDF uploaded yet. Please upload a reading material.';
            noPdfMessage.style.color = '#888';
            noPdfMessage.style.fontStyle = 'italic';
            selectedPdfContainer.appendChild(noPdfMessage);
            currentSelection.style.display = 'flex';
        } else {
            const noPdfMessage = document.createElement('p');
            noPdfMessage.textContent = 'Reading material will be uploaded soon.';
            noPdfMessage.style.color = '#888';
            noPdfMessage.style.fontStyle = 'italic';
            selectedPdfContainer.appendChild(noPdfMessage);
            currentSelection.style.display = 'flex';
        }
    } else {
        currentSelection.style.display = 'none';
    }
}

// Render topics
function renderTopics(topics) {
    // Don't render topics for logged-out users
    if (!currentUser) {
        topicList.innerHTML = '';
        return;
    }
    
    topicList.innerHTML = '';
    
    topics.forEach(topic => {
        const li = document.createElement('li');
        li.className = 'topic-item';
        if (topic.isSelected) {
            li.classList.add('selected-topic');
        }
        
        const topicInfo = document.createElement('div');
        topicInfo.style.flexGrow = '1';
        
        const topicText = document.createElement('span');
        topicText.textContent = topic.text;
        topicText.style.fontWeight = topic.isSelected ? 'bold' : 'normal';
        topicInfo.appendChild(topicText);
        
        // Never show week dates as requested
        
        const voteContainer = document.createElement('div');
        voteContainer.style.display = 'flex';
        voteContainer.style.alignItems = 'center';
        
        const voteCount = document.createElement('span');
        voteCount.className = 'votes';
        voteCount.textContent = topic.votes;
        
        const voteBtn = document.createElement('button');
        voteBtn.className = 'vote-btn';
        voteBtn.textContent = 'Upvote';
        const hasUpvoted = currentUser && 
                          currentUser.upvotedTopics && 
                          Array.isArray(currentUser.upvotedTopics) && 
                          currentUser.upvotedTopics.includes(topic._id);
        voteBtn.disabled = !currentUser || hasUpvoted;
        voteBtn.onclick = () => upvoteTopic(topic._id);
        
        voteContainer.appendChild(voteCount);
        voteContainer.appendChild(voteBtn);
        
        li.appendChild(topicInfo);
        li.appendChild(voteContainer);
        
        // Add PDF link if available and topic is selected
        if (topic.isSelected && topic.pdfFile && topic.pdfFile.filename) {
            const pdfContainer = document.createElement('div');
            pdfContainer.style.width = '100%';
            pdfContainer.style.marginTop = '10px';
            pdfContainer.style.textAlign = 'right';
            
            const pdfLink = createPdfLink(topic.pdfFile);
            pdfContainer.appendChild(pdfLink);
            
            li.appendChild(pdfContainer);
        }
        
        topicList.appendChild(li);
    });
}

// Update topic select dropdown
function updateTopicSelect(topics) {
    topicSelect.innerHTML = '<option value="">Select a topic...</option>';
    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic._id;
        option.textContent = topic.text;
        if (topic.isSelected) {
            option.selected = true;
            selectedTopicId = topic._id;
            uploadPdfSection.style.display = 'block';
        }
        topicSelect.appendChild(option);
    });
}

// Load topics for admin select
async function loadTopicsForSelect() {
    try {
        const response = await fetch(`${API_BASE}/api/topics`, {
            credentials: 'include'
        });
        const topics = await response.json();
        updateTopicSelect(topics);
    } catch (error) {
        console.error('Failed to load topics for select:', error);
    }
}

// Add a new topic
async function addTopic(text) {
    try {
        const response = await fetch(`${API_BASE}/api/topics`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            topicInput.value = '';
            loadTopics();
            fetchUserStats();
        }
    } catch (error) {
        console.error('Failed to add topic:', error);
    }
}

// Upvote a topic
async function upvoteTopic(topicId) {
    try {
        console.log(`Attempting to upvote topic: ${topicId}`);
        
        if (!currentUser) {
            console.error('Cannot upvote: User not logged in');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/topics/${topicId}/upvote`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            console.log('Upvote successful');
            // Refresh user data and topic list
            await checkAuth(); // Refresh user data 
            await loadTopics(); 
            await fetchUserStats();
        } else {
            const errorData = await response.json();
            console.error('Upvote error:', errorData.error);
            alert(`Error: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Failed to upvote topic:', error);
        alert('Failed to upvote topic. Please try again.');
    }
}

// Select a topic
async function selectTopic(topicId) {
    try {
        console.log(`Attempting to select topic with ID: ${topicId}`);
        
        if (!topicId) {
            console.error('Cannot select topic: No topic ID provided');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/topics/${topicId}/select`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            console.log('Topic selection successful');
            selectedTopicId = topicId;
            uploadPdfSection.style.display = 'block';
            loadTopics();
            fetchUserStats();
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Selection error:', errorData.error || response.statusText);
            alert(`Error selecting topic: ${errorData.error || response.statusText}`);
        }
    } catch (error) {
        console.error('Failed to select topic:', error);
        alert('Failed to select topic. Please try again.');
    }
}

// Upload PDF file
async function uploadPdf(topicId, formData) {
    try {
        uploadStatus.textContent = 'Uploading...';
        uploadStatus.style.color = 'blue';
        
        const response = await fetch(`${API_BASE}/api/topics/${topicId}/upload-pdf`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        if (response.ok) {
            uploadStatus.textContent = 'PDF uploaded successfully!';
            uploadStatus.style.color = 'green';
            pdfFileInput.value = '';
            loadTopics();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload PDF');
        }
    } catch (error) {
        uploadStatus.textContent = `Error: ${error.message}`;
        uploadStatus.style.color = 'red';
        console.error('Failed to upload PDF:', error);
    }
}

// Clear all topics
async function clearAllTopics() {
    if (!confirm('Are you sure you want to delete ALL topics? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/topics/clear-all`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            loadTopics();
            fetchUserStats();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to clear topics');
        }
    } catch (error) {
        console.error('Failed to clear topics:', error);
        alert(`Error: ${error.message}`);
    }
}

// Clear all topics except selected
async function clearExceptSelected() {
    if (!confirm('Are you sure you want to delete all topics EXCEPT the currently selected one? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/topics/clear-except-selected`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            loadTopics();
            fetchUserStats();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to clear topics');
        }
    } catch (error) {
        console.error('Failed to clear topics except selected:', error);
        alert(`Error: ${error.message}`);
    }
}

// Event listeners
loginBtn.addEventListener('click', () => {
    window.location.href = `${API_BASE}/auth/google`;
});

logoutBtn.addEventListener('click', () => {
    window.location.href = `${API_BASE}/auth/logout`;
});

topicForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const text = topicInput.value.trim();
    
    if (text) {
        addTopic(text);
    }
});

selectTopicBtn.addEventListener('click', () => {
    const topicId = topicSelect.value;
    console.log('Select topic button clicked, selected ID:', topicId);
    
    if (topicId) {
        selectTopic(topicId);
    } else {
        alert('Please select a topic from the dropdown first.');
    }
});

pdfUploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!selectedTopicId) {
        uploadStatus.textContent = 'Error: No topic selected';
        uploadStatus.style.color = 'red';
        return;
    }
    
    const file = pdfFileInput.files[0];
    if (!file) {
        uploadStatus.textContent = 'Error: Please select a PDF file';
        uploadStatus.style.color = 'red';
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
        uploadStatus.textContent = 'Error: File size exceeds 10MB limit';
        uploadStatus.style.color = 'red';
        return;
    }
    
    if (file.type !== 'application/pdf') {
        uploadStatus.textContent = 'Error: Only PDF files are allowed';
        uploadStatus.style.color = 'red';
        return;
    }
    
    const formData = new FormData();
    formData.append('pdfFile', file);
    
    uploadPdf(selectedTopicId, formData);
});

clearAllBtn.addEventListener('click', clearAllTopics);
clearExceptSelectedBtn.addEventListener('click', clearExceptSelected);

// Initial load
checkAuth();
loadTopics(); 