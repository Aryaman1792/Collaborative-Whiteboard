import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const InviteModal: React.FC = () => {
    const [show, setShow] = useState(false);
    const [email, setEmail] = useState('');

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        // Simulate sending invite
        const subject = encodeURIComponent('Join my Whiteboard Session');
        const body = encodeURIComponent(`Click here to join: ${window.location.href}`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`);
        handleClose();
    };

    return (
        <>
            <button className="btn glass-button" onClick={handleShow}>
                Invite
            </button>

            <Modal show={show} onHide={handleClose} centered contentClassName="glass-panel text-white" style={{ backdropFilter: 'blur(5px)' }}>
                <Modal.Header closeButton closeVariant="white" className="border-0">
                    <Modal.Title>Invite Collaborator</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleInvite}>
                        <Form.Group className="mb-3">
                            <Form.Label>Email address</Form.Label>
                            <Form.Control
                                type="email"
                                placeholder="Enter email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-transparent text-white"
                                style={{ border: '1px solid rgba(255,255,255,0.3)' }}
                                required
                            />
                        </Form.Group>
                        <div className="d-flex justify-content-end gap-2">
                            <Button variant="secondary" onClick={handleClose} className="glass-button">
                                Close
                            </Button>
                            <Button variant="primary" type="submit" className="glass-button">
                                Send Invite
                            </Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default InviteModal;
