# CRM 3.0 Future Development Tasks

## Completed Features 
- [x] Deal editing (title, description, client, dates)
- [x] Task functionality in deals (create, edit, delete)
- [x] Financial models restructuring (Deal ’ Policy ’ Payment ’ Income/Expenses)

---

## Frontend Enhancements

### 1. Client Management Improvements
- [ ] **EditClientForm Component** - Create form for editing existing client details
  - Support for editing name, phone, email, address, birth date, notes
  - Validate form inputs before submission
  - Update client info via API and refresh local state

- [ ] **Enhanced Client List View**
  - Add search/filter by client name or phone
  - Client contact info quick view in list
  - Link to view all deals for a client directly

### 2. Deal Notes System
- [ ] **NotesTab in DealsView**
  - Add/edit/delete notes for deals
  - Support for note status (active/archived)
  - Display creation date and author for each note
  - Notes archival instead of deletion

### 3. Task Management Enhancements
- [ ] **Task Subtasks Support**
  - Add checklist items/subtasks within each task
  - Mark subtasks as complete
  - Show progress (X of Y subtasks done)

- [ ] **Task Due Date Notifications**
  - Color-coded due date indicators:
    - Red: Overdue (negative days)
    - Red: Due today
    - Orange: Due within 3 days
  - Show remaining days count with proper Russian pluralization

- [ ] **Task Assignment**
  - Assign tasks to team members
  - Display assignee name on task
  - Filter tasks by assignee

### 4. Deal Status & Workflow
- [ ] **Extended Deal Status Options**
  - Add more detailed statuses: ">20O", " 0AG5B", "5@53>2>@K", "D>@<;5=85", "68405B ?@>4;5=8O"
  - Status color coding in UI

- [ ] **Close Deal Modal**
  - When closing a deal, show modal requesting reason
  - Automatically add reason to deal notes
  - Log the closure in activity history

- [ ] **Deal Owner/Assistant Fields**
  - Add deal.owner and deal.assistant fields to backend
  - Assign deal to team members
  - Show assignee info in deal header
  - Create user list for assignment dropdown

### 5. Deal Summary & Description
- [ ] **Deal Summary Display**
  - Show brief summary on deal overview tab
  - Edit summary inline or in modal
  - Use for quick deal context reference

### 6. File Management Improvements
- [ ] **File Upload Enhancements**
  - Show file size in human-readable format (KB, MB, GB)
  - File type icons (PDF, Word, Excel, Image, etc.)
  - Download file button
  - File preview for images

- [ ] **Batch File Upload**
  - Drag & drop multiple files
  - Progress indicator during upload

### 7. Chat & Activity Tracking
- [ ] **Deal Activity Log Tab**
  - Display timeline of all deal changes
  - Show who made the change and when
  - Log types: status changed, title updated, notes added, policy created, etc.

- [ ] **Chat System Polish**
  - Auto-scroll to newest messages
  - User avatars/initials
  - Timestamp for each message
  - Delete message functionality

### 8. User Interface Improvements
- [ ] **User Profile Dropdown**
  - Display current user info in header
  - Logout button
  - Settings quick access
  - User avatar/initials display

- [ ] **Loading States & Spinners**
  - Add LoadingSpinner component for async operations
  - Show loading states for API calls
  - Skeleton screens for data loading

- [ ] **Toast Notifications**
  - Show success/error/warning messages
  - Auto-dismiss after delay
  - Proper error handling with user-friendly messages

---

## Backend Enhancements

### 1. Deal Model Extensions
- [ ] **Add Deal Fields**
  - `owner` (FK to User) - seller
  - `assistant` (FK to User) - executor
  - `summary` - brief description
  - Extend status options to include more stages

- [ ] **Activity Log Model**
  - Track all deal changes
  - Store who made the change and when
  - Record old_value and new_value for audit trail

### 2. Notes System Backend
- [ ] **Note Model Implementation**
  - Create Note app/model
  - Support for active/archived status
  - Track creation date and author
  - Add serializer and viewset

### 3. Task Enhancements
- [ ] **Task Subtasks**
  - Add Subtask model with parent FK to Task
  - Support for completion tracking

- [ ] **Task Assignee**
  - Add assignee FK to User model
  - Ensure proper permissions/authorization

### 4. Financial Transaction Enhancements
- [ ] **Improve FinancialTransaction**
  - Add `paymentDate` field for actual payment tracking
  - Add `source` and `category` fields
  - Link to Payment where applicable
  - Support for marking transactions as paid

### 5. User & Permissions
- [ ] **User Management**
  - Create User management endpoints
  - List all users for dropdowns
  - User profile endpoint

- [ ] **Permissions & Authorization**
  - Implement proper DRF permissions
  - Restrict endpoint access by user role
  - Replace AllowAny with proper auth

### 6. Audit & Logging
- [ ] **Implement Audit Trail**
  - Record created_by and updated_by on all models
  - Automatically capture user context
  - ActivityLog entries for major operations

---

## API Improvements

### 1. Search & Filtering
- [ ] **Deal Search**
  - Search deals by title, client name
  - Filter by status, owner, date range

- [ ] **Client Search**
  - Search by name, phone, email
  - Pagination for large result sets

- [ ] **Pagination**
  - Implement limit/offset pagination
  - Add to all list endpoints
  - Frontend handling of paginated results

### 2. Bulk Operations
- [ ] **Bulk Deal Status Update**
  - Update multiple deals at once
  - Batch operations endpoint

- [ ] **Export Functionality**
  - CSV export of deals
  - PDF export of deal details
  - Financial summary export

### 3. Reporting
- [ ] **Financial Summary Endpoint**
  - Total income/expenses by period
  - By policy type, client, or user
  - Performance metrics

- [ ] **Deal Pipeline Report**
  - Deal count by status
  - Win rate metrics
  - Average deal value

---

## Integration & Advanced Features

### 1. AI/LLM Integration (Gemini API)
- [ ] **Text-to-Speech**
  - Generate audio from deal summaries
  - Play audio using Web Audio API
  - Speaker icon button in deal header

- [ ] **AI-Powered Deal Summary**
  - Auto-generate deal summaries from notes
  - Suggest next actions based on deal status

- [ ] **AI Assistant Features**
  - Draft email templates for client contact
  - Suggest follow-up tasks

### 2. Email Integration
- [ ] **Send Email from Deal**
  - Compose and send email to client
  - Email template library
  - Track email opens/clicks

### 3. Notifications
- [ ] **Overdue Task Alerts**
  - Notify users of overdue tasks
  - Upcoming review date reminders
  - Payment due date notifications

### 4. Mobile Responsiveness
- [ ] **Mobile UI Improvements**
  - Responsive grid layouts
  - Mobile-friendly modals
  - Touch-friendly buttons and inputs
  - Test on various screen sizes

---

## Testing & Quality

### 1. Frontend Tests
- [ ] **Unit Tests**
  - Test API client functions
  - Test form validation
  - Test state management

- [ ] **Component Tests**
  - Test individual components
  - Test user interactions
  - Test error states

### 2. Backend Tests
- [ ] **Model Tests**
  - Test model validations
  - Test model methods

- [ ] **API Tests**
  - Test endpoint functionality
  - Test permissions
  - Test error handling

### 3. E2E Tests
- [ ] **User Flow Tests**
  - Test complete deal creation flow
  - Test deal update flow
  - Test payment tracking flow

---

## Documentation & DevOps

### 1. Documentation
- [ ] **API Documentation**
  - OpenAPI/Swagger specs
  - Endpoint descriptions
  - Request/response examples

- [ ] **Frontend Component Documentation**
  - Storybook setup
  - Component prop documentation

### 2. Deployment
- [ ] **Docker Improvements**
  - Multi-stage builds for optimization
  - Health check endpoints
  - Proper logging configuration

- [ ] **CI/CD Pipeline**
  - GitHub Actions setup
  - Automated testing on PR
  - Automated deployments

---

## Priority Levels

### High Priority (Next Sprint)
1. EditClientForm component
2. Deal Notes system
3. Close deal modal with reason
4. User profile dropdown
5. Activity log backend

### Medium Priority (Following Sprints)
1. Task subtasks and assignees
2. File improvements (preview, bulk upload)
3. Extended deal status workflow
4. Search and filtering
5. Payment improvements

### Low Priority (Future)
1. AI/TTS integration
2. Email integration
3. Advanced reporting
4. Mobile optimization
5. Full test coverage

---

## Notes
- All backend changes require database migrations
- Maintain backward compatibility with existing API
- Update frontend types when backend models change
- Keep consistency with existing code style and patterns
