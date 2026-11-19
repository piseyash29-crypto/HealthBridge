/** Integration contract only; no real verification is implemented or simulated here. */
export interface AbdmAdapter {
 beginVerification(input: { abhaNumber: string; consentText: string }): Promise<{ transactionId: string }>;
 completeVerification(input: { transactionId: string; otp: string }): Promise<{ verified: true; abhaAddress: string }>;
 requestHealthInformation(input: { consentArtifactId: string; patientReference: string }): Promise<{ requestId: string }>;
 revokeConsent(consentArtifactId: string): Promise<void>;
}
export class UnconfiguredAbdmAdapter implements AbdmAdapter {
 private unavailable(): never { throw new Error('ABDM sandbox adapter not implemented. Obtain approved credentials and implement current documented workflows before enabling official mode.'); }
 async beginVerification(_input: {abhaNumber:string;consentText:string}):Promise<{transactionId:string}>{return this.unavailable()}
 async completeVerification(_input:{transactionId:string;otp:string}):Promise<{verified:true;abhaAddress:string}>{return this.unavailable()}
 async requestHealthInformation(_input:{consentArtifactId:string;patientReference:string}):Promise<{requestId:string}>{return this.unavailable()}
 async revokeConsent(_consentArtifactId:string):Promise<void>{return this.unavailable()}
}
