# Security Specification: ProAssess Cognitive Assessment

This specification documents the Zero-Trust attribute-based security invariants, threat vectors, and verification test cases for the ProAssess Firestore database.

## 1. Data Invariants & Security Models

### Users Collection (`/users/{userId}`)
*   **Invariant:** A candidate's profile is strictly owned by the authenticated user whose `uid` matches the document path.
*   **Read Access:** Only the authenticated owner can read their own profile. Blanket reads are strictly forbidden.
*   **Write Access:** Users can create or update their own profile.
*   **State Locking:** Users cannot alter administrative or verification fields (such as `status` or roles) to bypass the assessment flow once they are marked as `Completed` unless performed through secure backend routes.

### Drafts Collection (`/drafts/{userId}`)
*   **Invariant:** A candidate's active question answers and timers must be kept private and can only be modified by the candidate themselves.
*   **Read Access:** Only the authenticated owner whose `uid` matches the document ID can read their progress draft.
*   **Write Access:** Users can create or update their own draft. No one else may read or write.

### Results Collection (`/results/{resultId}`)
*   **Invariant:** Graded results represent secure, unalterable assessment scores generated and signed by the backend scoring service.
*   **Read Access:** Only the authenticated user associated with the result document (`resource.data.userId == request.auth.uid`) can fetch their profile.
*   **Write Access:** Candidates are forbidden from manually creating, modifying, or deleting results directly from the client. Creation and updates of results are restricted to trusted backend entities.

---

## 2. The "Dirty Dozen" Threat Payloads

The following malicious payload vectors are designed to break database security laws. The generated security rules must guarantee `PERMISSION_DENIED` for all:

1.  **Identity Spoofing on Create (User):** An authenticated user `user_A` attempts to register a profile under path `/users/user_B`.
2.  **Identity Spoofing on Update (User):** `user_A` attempts to modify `user_B`'s contact number or name.
3.  **Privilege Escalation (User Status):** `user_A` attempts to self-update their state from `In Progress` to `Completed` with a fake score without taking the test.
4.  **Blanket Scrape (Users):** `user_A` queries `/users` without a specific document ID.
5.  **Draft Theft (Draft):** `user_A` attempts to read the active drafts of `user_B` under `/drafts/user_B`.
6.  **Draft Poisoning (Draft):** `user_A` attempts to write malicious, oversized payloads or cheat states into `user_B`'s draft document.
7.  **Blanket Scrape (Drafts):** `user_A` attempts to list all drafts from the `/drafts` collection.
8.  **Malicious Results Forgery (Result Create):** `user_A` attempts to bypass the server-side grading API and write a self-calculated perfect score document (`100/100`) directly to `/results/malicious_result_1` with their `userId`.
9.  **Score Alteration (Result Update):** `user_A` attempts to change their existing graded score from `45` to `95`.
10. **Result Scraping (Results list):** `user_A` queries the `/results` collection without filtering by their own `userId` to steal other candidates' scores.
11. **Result Erasure (Result Delete):** `user_A` attempts to delete a poor-performing graded evaluation document in `/results/my_low_score` to demand a retake.
12. **Null-Bypass Injection (Root):** An unauthenticated client attempts to read `/users/user_A` using a null or empty authentication token.

---

## 3. Test Runner Design Assertions

To verify complete security:
*   `request.auth != null` is the prerequisite for any query.
*   `request.auth.uid == userId` must map to any read/write on `/users` and `/drafts`.
*   Writes to `/results` must be blocked on the client side entirely, keeping them strictly restricted to server environments.
