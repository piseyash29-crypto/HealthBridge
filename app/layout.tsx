import type { Metadata } from 'next';
export const metadata:Metadata={title:'HealthBridge — Connected Care',description:'A connected healthcare journey for patients, doctors and hospital teams.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
