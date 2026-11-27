# FitStalker iPhone release

**App name** FitStalker  
**Subtitle** Your closet, from a photo  
**Category** Lifestyle  
**Support** support@fitstalker.com  
**Privacy policy** https://fitstalker.com/privacy

## Store description

Build a private digital closet with photos of the clothes you already own. Take a photo or choose one from your library, name the piece, and save it to your closet. When AI identification is available, you can ask FitStalker to identify visible garments and review the details before saving a piece.

## Notes for App Review

Provide a dedicated username and password in App Review Information. The iPhone app uses FitStalker accounts and the production backend at fitstalker.com. Open My Closet, choose Add a piece, then use the camera or Photos picker. Enter a name and category and save. Tap Account to locate account deletion. Use a separate account for destructive verification.

Optional AI tools request permission before sending photo content through Vercel AI Gateway to Google. Virtual try-on visibility follows the backend capability. Mention it in reviewer notes and store metadata only after it has been enabled and verified on the review build. This version has no in-app purchases.

## Release handoff

Use the shared FitStalker scheme in Xcode 26 or newer. Confirm the proposed bundle ID `com.fitstalker.app` in App Store Connect and select the Apple Developer team before archiving. The GitHub workflow compiles the iPhone target without signing.

Archive a signed build, upload to TestFlight, and use a physical iPhone to verify fresh sign-up, password recovery, camera and library access, upload and reopen, AI if enabled, sign-out, and account deletion. Capture the required iPhone screenshots from that build. Complete App Privacy, age rating, export compliance, support and reviewer details in App Store Connect. Verify the privacy label against the iOS binary and active backend services before submission.
