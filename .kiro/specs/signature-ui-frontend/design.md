# Design Document: Signature UI Frontend

## Overview

This design document specifies the implementation of an electronic signature interface for the QuoteFast frontend application. The feature enables clients to digitally sign quotes through a public quote view by drawing their signature on an HTML canvas and providing their name.

The implementation consists of two primary React components:
- **SignatureCanvas**: A reusable canvas component that captures signature drawing input via mouse or touch
- **SignatureForm**: A form component that integrates the canvas, name input field, validation, and API submission

The feature integrates into the existing public quote page (`/q/[publicId]`) without disrupting current functionality. It coexists with the existing accept/reject actions and follows established patterns in the codebase including React Hook Form for form management, Zod for validation, TanStack Query for API mutations, and Tailwind CSS for styling.

## Architecture

### Component Hierarchy

```
PublicQuotePage (existing)
└── Action Area
    ├── SignatureForm (new)
    │   ├── Signer Name Input
    │   ├── SignatureCanvas (new)
    │   └── Action Buttons (Sign, Clear)
    └── Accept/Reject Buttons (existing)
```

### Data Flow

1. **User Input**: User draws on canvas and enters name
2. **Validation**: React Hook Form + Zod validate inputs
3. **Canvas Conversion**: Canvas content converted to base64 PNG data URI
4. **API Submission**: TanStack Query mutation sends data to backend
5. **State Update**: On success, quote status updates to SIGNED and UI refreshes
6. **Error Handling**: On failure, error messages display and form remains editable

### State Management

The feature uses multiple state management approaches:

- **Form State**: React Hook Form manages form fields (signerName, signatureImage)
- **Canvas State**: Local React state tracks drawing state (isDrawing, isEmpty)
- **API State**: TanStack Query manages mutation state (loading, error, success)
- **Page State**: Existing page state tracks quote status and action completion

### Integration Points

1. **Public Quote Page**: Conditional rendering based on quote status
2. **Backend API**: POST /api/public/quotes/:publicId/sign
3. **Type System**: Extends existing QuoteStatus type to include 'SIGNED'
4. **Hooks**: New useSignQuote hook follows existing useAcceptQuote pattern
5. **UI Components**: Reuses existing Button component

## Components and Interfaces

### SignatureCanvas Component

A reusable canvas component that captures signature drawing input.

**Props Interface:**
```typescript
interface SignatureCanvasProps {
  onChange: (dataUrl: string | null) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  className?: string;
}
```

**Responsibilities:**
- Render HTML canvas element with appropriate dimensions
- Handle mouse and touch events for drawing
- Maintain drawing state (isDrawing, isEmpty)
- Render strokes with specified styling (black, 2px width, smooth joins)
- Display placeholder text when empty
- Provide clear() method to erase canvas
- Convert canvas to base64 PNG data URI
- Notify parent of changes via onChange callback

**Key Methods:**
- `startDrawing(e: MouseEvent | TouchEvent)`: Begin capturing stroke
- `draw(e: MouseEvent | TouchEvent)`: Continue stroke following pointer
- `stopDrawing()`: Complete current stroke
- `clear()`: Erase all canvas content
- `toDataURL()`: Convert canvas to base64 PNG
- `getPointerPosition(e: MouseEvent | TouchEvent)`: Extract coordinates

**Implementation Details:**
- Uses useRef to access canvas element and 2D context
- Uses useEffect to set up event listeners
- Handles both mouse events (mousedown, mousemove, mouseup) and touch events (touchstart, touchmove, touchend)
- Prevents default touch behavior to avoid scrolling during drawing
- Tracks isEmpty state to show/hide placeholder text
- Calls onChange with data URL when drawing completes
- Responsive sizing based on viewport (mobile vs desktop)

### SignatureForm Component

A form component that integrates canvas, name input, validation, and submission.

**Props Interface:**
```typescript
interface SignatureFormProps {
  publicId: string;
  onSuccess: () => void;
}
```

**Form Schema (Zod):**
```typescript
const signatureSchema = z.object({
  signerName: z
    .string()
    .min(1, 'Por favor ingrese su nombre')
    .max(255, 'El nombre no puede exceder 255 caracteres'),
  signatureImage: z
    .string()
    .min(1, 'Por favor dibuje su firma')
    .refine(
      (val) => val.startsWith('data:image/png;base64,'),
      'Formato de firma inválido'
    )
    .refine(
      (val) => {
        // Check size: base64 string length * 0.75 gives approximate byte size
        const sizeInBytes = (val.length * 0.75);
        return sizeInBytes <= 5 * 1024 * 1024; // 5MB
      },
      'La firma es demasiado grande'
    ),
});

type SignatureFormData = z.infer<typeof signatureSchema>;
```

**Responsibilities:**
- Render form with name input and signature canvas
- Manage form state with React Hook Form
- Validate inputs with Zod schema
- Handle canvas changes and update form field
- Submit data to backend via TanStack Query mutation
- Display loading state during submission
- Display error messages from validation or API
- Call onSuccess callback when submission succeeds
- Preserve form data on error for retry

**Key Features:**
- Integrates SignatureCanvas component
- Uses React Hook Form's register and setValue for form fields
- Uses zodResolver for schema validation
- Displays field-level error messages
- Disables form during submission
- Provides clear button to reset canvas
- Responsive layout (vertical on mobile, horizontal buttons on desktop)

### useSignQuote Hook

A TanStack Query mutation hook for submitting signatures.

**Interface:**
```typescript
interface SignQuotePayload {
  signerName: string;
  signatureImage: string;
}

export function useSignQuote(publicId: string) {
  return useMutation({
    mutationFn: async (payload: SignQuotePayload) => {
      await publicClient.post(`/public/quotes/${publicId}/sign`, payload);
    },
  });
}
```

**Error Handling:**
The hook relies on axios error responses. The SignatureForm component catches errors and maps HTTP status codes to user-friendly messages:
- 400: Display API error message
- 404: "Cotización no encontrada"
- 409: "Esta cotización ya no puede ser firmada"
- 500: "Error del servidor. Intenta de nuevo más tarde."
- Network error: "Error de conexión. Verifica tu internet e intenta de nuevo."

## Data Models

### Type Extensions

**QuoteStatus Type:**
```typescript
export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SIGNED'; // New status
```

**Terminal States:**
```typescript
const TERMINAL_STATES = new Set<QuoteStatus>([
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'SIGNED', // Add to terminal states
]);
```

**Signable States:**
```typescript
const SIGNABLE_STATES = new Set<QuoteStatus>(['SENT', 'VIEWED']);
```

### API Payload

**Request:**
```typescript
POST /api/public/quotes/:publicId/sign
Content-Type: application/json

{
  "signerName": "string (1-255 chars)",
  "signatureImage": "data:image/png;base64,..." (max 5MB)
}
```

**Response (Success):**
```typescript
200 OK
Content-Type: application/json

{
  "message": "Quote signed successfully"
}
```

**Response (Error):**
```typescript
400 Bad Request | 404 Not Found | 409 Conflict | 500 Internal Server Error
Content-Type: application/json

{
  "error": "Error message"
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Form visibility for signable states

*For any* quote object, the Signature_Form should be displayed if and only if the quote status is SENT or VIEWED.

**Validates: Requirements 1.1**

### Property 2: Continuous stroke rendering

*For any* sequence of pointer movements while the pointer is pressed, the canvas should render a continuous stroke that follows the complete path of the pointer movement.

**Validates: Requirements 2.2**

### Property 3: Clear erases all content

*For any* canvas state with drawn content, calling the clear function should result in an empty canvas with no visible strokes.

**Validates: Requirements 3.1**

### Property 4: Empty canvas validation

*For any* form submission attempt where the signatureImage field is empty or null, the form validation should fail with the error message "Por favor dibuje su firma".

**Validates: Requirements 4.1**

### Property 5: Empty name validation

*For any* form submission attempt where the signerName field is empty or contains only whitespace, the form validation should fail with the error message "Por favor ingrese su nombre".

**Validates: Requirements 4.2**

### Property 6: Name length validation

*For any* signerName string exceeding 255 characters, the form validation should fail with the error message "El nombre no puede exceder 255 caracteres".

**Validates: Requirements 4.3**

### Property 7: Submission prevention with validation errors

*For any* form state containing validation errors, attempting to submit the form should be prevented and no API call should be made.

**Validates: Requirements 4.4**

### Property 8: Error clearing on input correction

*For any* form field with a validation error, when the user modifies the field to a valid value, the error message for that field should be cleared.

**Validates: Requirements 4.5**

### Property 9: Canvas to base64 conversion format

*For any* non-empty canvas content, converting the canvas to a data URL should produce a string that starts with "data:image/png;base64," followed by valid base64-encoded data.

**Validates: Requirements 5.1**

### Property 10: API submission with valid data

*For any* valid form data (signerName and signatureImage meeting all validation rules), submitting the form should trigger a POST request to /api/public/quotes/:publicId/sign with the correct payload structure.

**Validates: Requirements 5.3**

### Property 11: Button re-enabling after error

*For any* API error response, the sign button and clear button should transition from disabled to enabled state.

**Validates: Requirements 7.6**

### Property 12: Form data preservation after error

*For any* API error response, the signerName value and signatureImage value should remain unchanged from their pre-submission values.

**Validates: Requirements 7.7**

### Property 13: PNG data URI format validation

*For any* signatureImage value submitted for validation, if it does not start with "data:image/png;base64,", the validation should fail with an appropriate error message.

**Validates: Requirements 11.5**

### Property 14: Error message accessibility association

*For any* form field with a validation error, the error message element should be associated with the form field via the aria-describedby attribute.

**Validates: Requirements 12.4**

## Error Handling

### Validation Errors

The form implements client-side validation using Zod schema before API submission:

**Empty Signature Canvas:**
- Error: "Por favor dibuje su firma"
- Trigger: signatureImage field is empty or null
- Display: Below canvas component
- Recovery: User draws on canvas

**Empty Signer Name:**
- Error: "Por favor ingrese su nombre"
- Trigger: signerName field is empty or whitespace-only
- Display: Below name input field
- Recovery: User enters name

**Name Too Long:**
- Error: "El nombre no puede exceder 255 caracteres"
- Trigger: signerName length > 255
- Display: Below name input field
- Recovery: User shortens name

**Signature Too Large:**
- Error: "La firma es demasiado grande"
- Trigger: base64 data URI size > 5MB
- Display: Below canvas component
- Recovery: User clears and draws simpler signature

**Invalid Format:**
- Error: "Formato de firma inválido"
- Trigger: signatureImage doesn't start with "data:image/png;base64,"
- Display: Below canvas component
- Recovery: Internal error, should not occur in normal use

### API Errors

The form handles backend API errors by mapping HTTP status codes to user-friendly Spanish messages:

**400 Bad Request:**
- Display: Error message from API response body
- Recovery: User corrects input based on message
- Buttons: Re-enabled
- Data: Preserved

**404 Not Found:**
- Display: "Cotización no encontrada"
- Recovery: User verifies quote link
- Buttons: Re-enabled
- Data: Preserved

**409 Conflict:**
- Display: "Esta cotización ya no puede ser firmada"
- Recovery: User refreshes page to see current status
- Buttons: Re-enabled
- Data: Preserved

**500 Internal Server Error:**
- Display: "Error del servidor. Intenta de nuevo más tarde."
- Recovery: User retries after waiting
- Buttons: Re-enabled
- Data: Preserved

**Network Error:**
- Display: "Error de conexión. Verifica tu internet e intenta de nuevo."
- Recovery: User checks connection and retries
- Buttons: Re-enabled
- Data: Preserved

### Error Display Strategy

- Field-level errors display below their respective form fields
- API errors display at the form level (above buttons)
- Errors are styled with red text and red border accents
- Errors are associated with form fields via aria-describedby for accessibility
- Errors clear automatically when user corrects the input
- Multiple errors can display simultaneously (one per field)

## Testing Strategy

### Dual Testing Approach

This feature requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests** verify specific examples, edge cases, and error conditions:
- Specific UI element presence (buttons, labels, placeholders)
- Specific error messages for each HTTP status code
- Responsive breakpoint behavior (mobile vs desktop)
- Accessibility attributes (aria-label, aria-busy, aria-describedby)
- Success state transitions
- Integration with existing accept/reject functionality

**Property Tests** verify universal properties across all inputs:
- Form visibility logic for all quote statuses
- Stroke rendering for any pointer movement sequence
- Clear functionality for any drawn content
- Validation rules for any input values
- Canvas conversion for any drawn signature
- Error recovery for any error response
- Data preservation for any error scenario

Together, unit tests catch concrete bugs in specific scenarios while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library:** fast-check (JavaScript/TypeScript property-based testing library)

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with comment referencing design property
- Tag format: `// Feature: signature-ui-frontend, Property {number}: {property_text}`

**Example Property Test Structure:**
```typescript
import fc from 'fast-check';

// Feature: signature-ui-frontend, Property 1: Form visibility for signable states
test('form displays only for SENT or VIEWED status', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SIGNED'),
      (status) => {
        const quote = { ...mockQuote, status };
        const { container } = render(<PublicQuotePage params={{ publicId: 'test' }} />);
        const formPresent = container.querySelector('[data-testid="signature-form"]') !== null;
        const shouldDisplay = status === 'SENT' || status === 'VIEWED';
        expect(formPresent).toBe(shouldDisplay);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Focus Areas

**Component Rendering:**
- SignatureCanvas renders with correct dimensions
- SignatureForm renders all required elements
- Placeholder text displays when canvas is empty
- Buttons have correct labels ("Firmar", "Limpiar")

**User Interactions:**
- Mouse down starts drawing
- Mouse move renders stroke
- Mouse up completes stroke
- Touch events work on mobile
- Clear button erases canvas

**Form Validation:**
- Empty canvas shows error
- Empty name shows error
- Name over 255 chars shows error
- Invalid format shows error
- Valid inputs pass validation

**API Integration:**
- Successful submission updates status
- Success message displays
- Form hides after success
- Each error code shows correct message
- Network errors handled gracefully

**Accessibility:**
- Canvas has aria-label
- Name input has visible label
- Buttons have aria-busy during loading
- Errors associated with fields
- Screen reader announcements work

**Responsive Design:**
- Mobile viewport uses smaller canvas
- Desktop viewport uses larger canvas
- Button layout changes with viewport
- Input field spans full width on mobile

### Test File Organization

```
test/frontend/src/
├── components/
│   ├── SignatureCanvas.test.tsx (unit tests)
│   ├── SignatureCanvas.pbt.test.tsx (property tests)
│   ├── SignatureForm.test.tsx (unit tests)
│   └── SignatureForm.pbt.test.tsx (property tests)
└── app/
    └── q/
        └── [publicId]/
            ├── page.test.tsx (unit tests)
            └── page.pbt.test.tsx (property tests)
```

### Coverage Goals

- Unit test coverage: 90%+ for new components
- Property test coverage: All 14 correctness properties implemented
- Integration test coverage: Full user flow from drawing to submission
- Accessibility test coverage: All WCAG 2.1 Level A requirements

