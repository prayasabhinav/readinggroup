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
        
        // Sort topics by votes in descending order
        topics.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        
        // Count non-selected topics
        const nonSelectedTopics = topics.filter(topic => !topic.isSelected);
        
        // Hide or show the proposed topics heading based on whether there are non-selected topics
        if (nonSelectedTopics.length === 0) {
            proposedTopicsHeading.style.display = 'none';
        } else {
            proposedTopicsHeading.style.display = 'block';
        }
        
        renderTopics(topics);
        updateTopicSelect(topics);
        updateCurrentSelection(topics);
        
        // Return the topics array to allow proper Promise chaining
        return topics;
    } catch (error) {
        console.error('Failed to load topics:', error);
        // Hide the heading if there's an error loading topics
        proposedTopicsHeading.style.display = 'none';
        throw error; // Re-throw the error for proper error handling
    }
}

// Create PDF link element
function createPdfLink(pdfFile) {
    const link = document.createElement('a');
    link.href = `/uploads/${pdfFile.filename}`;
    link.className = 'pdf-link';
    link.target = '_blank';
    link.style.verticalAlign = 'middle';
    
    // Create an icon element for the PDF
    const icon = document.createElement('span');
    icon.innerHTML = '📄';
    icon.style.marginRight = '6px';
    icon.style.fontSize = '1.1em';
    icon.style.display = 'inline-block';
    icon.style.verticalAlign = 'middle';
    
    // Create text element 
    const text = document.createElement('span');
    text.textContent = `${pdfFile.originalname}`;
    text.style.verticalAlign = 'middle';
    text.style.display = 'inline-block';
    
    // Add both to the link
    link.appendChild(icon);
    link.appendChild(text);
    
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
            const pdfContainer = document.createElement('div');
            pdfContainer.style.display = 'flex';
            pdfContainer.style.alignItems = 'center';
            pdfContainer.style.justifyContent = 'center';
            
            const pdfLink = createPdfLink(selectedTopic.pdfFile);
            pdfContainer.appendChild(pdfLink);
            
            selectedPdfContainer.appendChild(pdfContainer);
            currentSelection.style.display = 'flex';
        } else if (currentUser && currentUser.isAdmin) {
            const noPdfMessage = document.createElement('p');
            noPdfMessage.textContent = 'No PDF uploaded yet. Please upload a reading material.';
            noPdfMessage.style.color = '#888';
            noPdfMessage.style.fontStyle = 'italic';
            noPdfMessage.style.margin = '0';
            noPdfMessage.style.padding = '8px 0';
            selectedPdfContainer.appendChild(noPdfMessage);
            currentSelection.style.display = 'flex';
        } else {
            const noPdfMessage = document.createElement('p');
            noPdfMessage.textContent = 'Reading material will be uploaded soon.';
            noPdfMessage.style.color = '#888';
            noPdfMessage.style.fontStyle = 'italic';
            noPdfMessage.style.margin = '0';
            noPdfMessage.style.padding = '8px 0';
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
        // Skip rendering the selected topic in the main list since it's already shown at the top
        if (topic.isSelected) {
            return;
        }
        
        const topicElement = createTopicElement(topic);
        topicList.appendChild(topicElement);
    });
}

// Helper function to create a topic element
function createTopicElement(topic) {
    const li = document.createElement('li');
    li.className = 'topic-item';
    li.setAttribute('data-id', topic._id);
    
    const topicInfo = document.createElement('div');
    topicInfo.style.flexGrow = '1';
    
    const topicText = document.createElement('span');
    topicText.textContent = topic.text;
    topicInfo.appendChild(topicText);
    
    // Add voters link
    const votersLink = document.createElement('a');
    votersLink.href = '#';
    votersLink.textContent = 'Show voters';
    votersLink.style.fontSize = '0.8em';
    votersLink.style.marginLeft = '10px';
    votersLink.style.color = '#2196F3';
    votersLink.style.cursor = 'pointer';
    votersLink.onclick = (e) => {
        e.preventDefault();
        showVoters(topic._id);
    };
    
    const votersContainer = document.createElement('div');
    votersContainer.id = `voters-${topic._id}`;
    votersContainer.style.display = 'none';
    votersContainer.style.marginTop = '5px';
    votersContainer.style.fontSize = '0.8em';
    votersContainer.style.fontStyle = 'italic';
    votersContainer.style.color = '#666';
    
    topicInfo.appendChild(document.createElement('br'));
    topicInfo.appendChild(votersLink);
    topicInfo.appendChild(votersContainer);
    
    // Add proposer link
    const proposerLink = document.createElement('a');
    proposerLink.href = '#';
    proposerLink.textContent = 'Show proposer';
    proposerLink.style.fontSize = '0.8em';
    proposerLink.style.marginLeft = '10px';
    proposerLink.style.color = '#2196F3';
    proposerLink.style.cursor = 'pointer';
    
    const proposerContainer = document.createElement('div');
    proposerContainer.id = `proposer-${topic._id}`;
    proposerContainer.style.display = 'none';
    proposerContainer.style.marginTop = '5px';
    proposerContainer.style.fontSize = '0.8em';
    proposerContainer.style.fontStyle = 'italic';
    proposerContainer.style.color = '#666';
    
    proposerLink.onclick = (e) => {
        e.preventDefault();
        showProposer(topic._id, proposerLink, proposerContainer);
    };
    
    topicInfo.appendChild(proposerLink);
    topicInfo.appendChild(proposerContainer);
    
    const voteContainer = document.createElement('div');
    voteContainer.style.display = 'flex';
    voteContainer.style.alignItems = 'center';
    voteContainer.style.minHeight = '40px'; // Match the minimum height for alignment
    
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
    
    // Optimistic UI update for faster upvote
    voteBtn.onclick = () => {
        // Disable button immediately for better UX
        voteBtn.disabled = true;
        
        // Apply highlight to the current topic item
        const parentLi = voteBtn.closest('.topic-item');
        if (parentLi) {
            // Apply a background highlight with a smooth transition
            parentLi.style.transition = "background-color 0.3s ease";
            parentLi.style.backgroundColor = "#e3f2fd";
            
            // Remove the highlight after a short delay
            setTimeout(() => {
                parentLi.style.backgroundColor = "";
            }, 800);
        }
        
        // Optimistically update the UI
        voteCount.textContent = (parseInt(voteCount.textContent) || 0) + 1;
        if (!currentUser.upvotedTopics) {
            currentUser.upvotedTopics = [];
        }
        currentUser.upvotedTopics.push(topic._id);
        
        // Initiate the actual API call
        upvoteTopic(topic._id)
            .then(() => {
                // Add a small delay to let the user see the highlight before reordering
                setTimeout(() => {
                    reorderTopics();
                }, 300);
            })
            .catch(() => {
                // Rollback optimistic update if there's an error
                voteCount.textContent = (parseInt(voteCount.textContent) || 1) - 1;
                voteBtn.disabled = false;
                if (currentUser.upvotedTopics) {
                    const idx = currentUser.upvotedTopics.indexOf(topic._id);
                    if (idx !== -1) {
                        currentUser.upvotedTopics.splice(idx, 1);
                    }
                }
                // Reset the background color
                if (parentLi) {
                    parentLi.style.backgroundColor = "";
                }
                alert('Failed to upvote. Please try again.');
            });
    };
    
    voteContainer.appendChild(voteCount);
    voteContainer.appendChild(voteBtn);
    
    li.appendChild(topicInfo);
    li.appendChild(voteContainer);
    
    return li;
}

// Function to fetch and show voters for a topic
async function showVoters(topicId) {
    const votersContainer = document.getElementById(`voters-${topicId}`);
    const voterLink = votersContainer.previousSibling;
    
    // Toggle visibility
    if (votersContainer.style.display === 'none') {
        votersContainer.innerHTML = 'Loading voters...';
        votersContainer.style.display = 'block';
        voterLink.textContent = 'Hide voters';
        
        try {
            const response = await fetch(`${API_BASE}/api/topics/${topicId}/voters`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const voters = await response.json();
                
                if (voters.length === 0) {
                    votersContainer.textContent = 'No upvotes yet';
                } else {
                    const voterNames = voters.map(v => v.name || v.email).join(', ');
                    votersContainer.textContent = `Upvoted by: ${voterNames}`;
                }
            } else {
                votersContainer.textContent = 'Failed to load voters';
            }
        } catch (error) {
            console.error('Error fetching voters:', error);
            votersContainer.textContent = 'Error loading voters';
        }
    } else {
        votersContainer.style.display = 'none';
        voterLink.textContent = 'Show voters';
    }
}

// Function to fetch and show proposer of a topic
async function showProposer(topicId, proposerLink, proposerContainer) {
    // Toggle visibility
    if (proposerContainer.style.display === 'none') {
        proposerContainer.innerHTML = 'Loading proposer...';
        proposerContainer.style.display = 'block';
        proposerLink.textContent = 'Hide proposer';
        
        try {
            const response = await fetch(`${API_BASE}/api/topics/${topicId}/proposer`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const proposer = await response.json();
                if (proposer && proposer.name) {
                    proposerContainer.textContent = `Proposed by: ${proposer.name}`;
                } else {
                    proposerContainer.textContent = 'Proposer information not available';
                }
            } else {
                proposerContainer.textContent = 'Failed to load proposer';
            }
        } catch (error) {
            console.error('Error fetching proposer:', error);
            proposerContainer.textContent = 'Error loading proposer';
        }
    } else {
        proposerContainer.style.display = 'none';
        proposerLink.textContent = 'Show proposer';
    }
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

// Upvote a topic - make this return a promise for optimistic UI
async function upvoteTopic(topicId) {
    console.log('Attempting to upvote topic:', topicId);
    
    try {
        const response = await fetch(`${API_BASE}/api/topics/${topicId}/upvote`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Upvote error:', errorData.error || response.statusText);
            throw new Error(errorData.error || 'Failed to upvote');
        }
        
        console.log('Upvote successful');
        fetchUserStats();
        return await response.json();
    } catch (error) {
        console.error('Failed to upvote topic:', error);
        throw error;
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

// Add a new function to reorder topics based on vote count
function reorderTopics() {
    try {
        // Don't use animation if we have no topics
        if (!topicList || !topicList.children.length) {
            loadTopics();
            return;
        }
        
        // First, add animation styles if not already present
        if (!document.getElementById('animation-styles')) {
            const style = document.createElement('style');
            style.id = 'animation-styles';
            style.textContent = `
                .topic-item {
                    transition: transform 0.5s ease-out, opacity 0.5s ease-out;
                }
                .highlight-upvote {
                    background-color: #e3f2fd;
                }
                .animating-topic {
                    transition: transform 0.8s ease-out;
                    z-index: 10;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Clear any existing highlight-upvote classes to avoid persistent blue backgrounds
        document.querySelectorAll('.highlight-upvote').forEach(el => {
            el.classList.remove('highlight-upvote');
        });
        
        // Save the current positions of all topic items
        const topicItems = Array.from(topicList.children);
        const positions = {};
        
        // Record initial positions of all items
        topicItems.forEach(item => {
            const id = item.getAttribute('data-id');
            const rect = item.getBoundingClientRect();
            positions[id] = rect.top;
        });
        
        // Get updated topic data
        fetch(`${API_BASE}/api/topics`, { credentials: 'include' })
            .then(response => response.json())
            .then(topics => {
                // Filter out selected topics and sort by votes
                const nonSelectedTopics = topics.filter(topic => !topic.isSelected);
                nonSelectedTopics.sort((a, b) => (b.votes || 0) - (a.votes || 0));
                
                // Update the vote count on each item
                topicItems.forEach(item => {
                    const id = item.getAttribute('data-id');
                    const topicData = nonSelectedTopics.find(t => t._id === id);
                    if (topicData) {
                        const voteCountEl = item.querySelector('.votes');
                        if (voteCountEl) {
                            voteCountEl.textContent = topicData.votes;
                        }
                    }
                });
                
                // Remove all items from the list but keep references
                while (topicList.firstChild) {
                    topicList.removeChild(topicList.firstChild);
                }
                
                // Create a map of items by id for easy lookup
                const itemsById = {};
                topicItems.forEach(item => {
                    const id = item.getAttribute('data-id');
                    itemsById[id] = item;
                });
                
                // Add items back in sorted order
                nonSelectedTopics.forEach(topic => {
                    const item = itemsById[topic._id];
                    if (item) {
                        topicList.appendChild(item);
                    }
                });
                
                // Force a reflow to ensure DOM updates
                void topicList.offsetHeight;
                
                // Now apply transforms to animate from old to new positions
                topicItems.forEach(item => {
                    const id = item.getAttribute('data-id');
                    const oldPosition = positions[id];
                    const newPosition = item.getBoundingClientRect().top;
                    const delta = oldPosition - newPosition;
                    
                    // If there's a significant change in position, animate it
                    if (Math.abs(delta) > 5) {
                        // Add the animation class
                        item.classList.add('animating-topic');
                        
                        // Start at the old position
                        item.style.transform = `translateY(${delta}px)`;
                        
                        // Force a reflow
                        void item.offsetHeight;
                        
                        // Animate to the new position
                        setTimeout(() => {
                            item.style.transform = 'translateY(0)';
                        }, 10);
                        
                        // Remove the animation class when finished
                        item.addEventListener('transitionend', function onEnd() {
                            item.classList.remove('animating-topic');
                            item.removeEventListener('transitionend', onEnd);
                        }, { once: true });
                    }
                });
            })
            .catch(error => {
                console.error('Error updating topics:', error);
                loadTopics(); // Fall back to reload if animation fails
            });
            
    } catch (error) {
        console.error('Animation error, falling back to reload:', error);
        loadTopics();
    }
} 