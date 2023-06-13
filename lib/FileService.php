<?php
/**
 * @author Piotr Mrowczynski <piotr@owncloud.com>
 *
 * @copyright Copyright (c) 2023, ownCloud GmbH
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License, version 3,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License, version 3,
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 *
 */
namespace OCA\Richdocuments;

use OCP\Files\IRootFolder;
use OCP\IUserSession;
use OCP\Files\File;
use OCP\ILogger;
use OCP\IUserManager;
use OCA\Richdocuments\AppConfig;
use Symfony\Component\EventDispatcher\GenericEvent;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;

class FileService {
	/**
	 * @var ILogger
	 */
	private $logger;
	
	/**
	 * @var AppConfig
	 */
	private $appConfig;

	/**
	 * @var IUserManager
	 */
	private $userManager;

	/**
	 * @var IUserSession
	 */
	private $userSession;

	/**
	 * @var EventDispatcherInterface
	 */
	private $eventDispatcher;

	/**
	 * @var IRootFolder
	 */
	private $rootFolder;
	
	public function __construct(
		ILogger $logger,
		AppConfig $appConfig,
		IUserManager $userManager,
		IUserSession $userSession,
		EventDispatcherInterface $eventDispatcher,
		IRootFolder $rootFolder
	) {
		$this->appConfig = $appConfig;
		$this->logger = $logger;
		$this->userManager = $userManager;
		$this->userSession = $userSession;
		$this->eventDispatcher = $eventDispatcher;
		$this->rootFolder = $rootFolder;
	}

	/**
	 * Get privileged access to original file handle as user
	 * for given fileId
	 *
	 * @param int $fileId original file id
	 * @param string $ownerUID original file owner
	 * @param string $userUID file editor
	 *
	 * @return null|File
	 */
	public function getFileHandle(int $fileId, string $ownerUID, string $userUID): ?File {
		if (!$ownerUID) {
			$this->logger->warning('getFileHandle(): owner must be provided', ['app' => 'richdocuments']);
			return null;
		}

		if ($userUID) {
			$user = $this->userManager->get($userUID);
			if (!$user) {
				$this->logger->warning('getFileHandle(): No such user', ['app' => 'richdocuments']);
				return null;
			}

			// Make sure editor session is opened for registering activity over file handle
			$this->logger->debug('getFileHandle(): Register session as ' . $userUID, ['app' => 'richdocuments']);
			if (!$this->appConfig->encryptionEnabled()) {
				// Set session for a user
				$this->userSession->setUser($user);
			} elseif ($this->appConfig->masterEncryptionEnabled()) {
				// With master encryption, decryption is based on master key (no user password needed)
				// make sure audit/activity is triggered for editor session
				$this->userSession->setUser($user);

				// emit login event to allow decryption of files via master key
				$afterEvent = new GenericEvent(null, ['loginType' => 'password', 'user' => $user, 'uid' => $userUID, 'password' => '']);
				$this->eventDispatcher->dispatch($afterEvent, 'user.afterlogin');
			} else {
				// other type of encryption is enabled (e.g. user-key) that does not allow to decrypt files without incognito access to files
				$this->setIncognitoMode(true);
			}
		} else {
			// Public link access
			$this->setIncognitoMode(true);
		}

		// Setup FS of original file file-handle to be able to generate
		// file versions and write files with user session set for editor
		// take 1st mount as here we access original version of the file from owner
		$this->setupFS($ownerUID);
		$root = $this->rootFolder->getUserFolder($ownerUID);
		$files = $root->getById($fileId);
		if ($files !== [] && $files[0] instanceof File) {
			return $files[0];
		}
		return null;
	}

	/**
	 * Set the incognito mode
	 *
	 * @param bool $status Flag to enable or disable incognito mode
	 */
	protected function setIncognitoMode(bool $status): void {
		\OC_User::setIncognitoMode($status);
	}

	/**
	 * Setup the fs for user
	 *
	 * @param string $uid User ID
	 */
	protected function setupFS($uid): void {
		\OC_Util::tearDownFS();
		\OC_Util::setupFS($uid);
	}
}