import * as React from 'react';

export default function ExternalLinksTab() {
    return (
        <div style={{ padding: '20px' }}>
            <h3>External Resources</h3>
            <p>
                <a
                    href="https://en.wikipedia.org/wiki/Kidney_cancer"
                    target="_blank"
                    rel="noreferrer"
                >
                    Kidney cancer on Wikipedia
                </a>
            </p>
            <p>
                This is the first custom tab created for UT Southwestern. This
                is a test!
            </p>
        </div>
    );
}
