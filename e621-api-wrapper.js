const axios = require('axios').default;
const fs = require(`fs`);
const qs = require('qs');
const FormData = require('form-data');
const crypto = require(`crypto`);


function __is_object(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}
function merge_deep(target, source) {
	let output = Object.assign({}, target);
	if (__is_object(target) && __is_object(source)) {
		Object.keys(source).forEach(key => {
			if (__is_object(source[key])) {
				if (!(key in target))
					Object.assign(output, { [key]: source[key] });
				else
					output[key] = merge_deep(target[key], source[key]);
			} else {
				Object.assign(output, { [key]: source[key] });
			}
		});
	}
	return output;
}
function is_url(string) {
	try { new URL(string); }
	catch (e) { return false; }
	return true;
}

class e621 {
	/**
	 * Assign account credentials to this instance.
	 * @param {string} project_name - The name of your project.
	 * @param {string} options 
	 * @param {string} [options.username] The username of the account.
	 * @param {string} [options.api_key] The API key of the account.
	 * @param {string} [options.base_url=https://e621.net] The base url for this API to use.
	 */
	constructor(project_name, { username, api_key, base_url = "https://e621.net" } = {}) {
		if (!project_name) throw new Error(`No project_name supplied. This is required to identify your project.`);

		this.username = username;
		this.api_key = api_key;
		this.base_url = base_url;

		this.request_settings = {
			headers: {
				"User-Agent": `${project_name}/(by Armored_Dragon)`
			}
		};

		if (username && api_key) {
			this.request_settings['auth'] = {
				username: this.username,
				password: this.api_key
			};
		}
	}

	/* ---------------------------- Internal helpers ---------------------------- */
	async _makePostRequest(path, post_data, as_urlencoded = true, options = { headers: {} }) {
		if (as_urlencoded) {
			post_data = qs.stringify(post_data);
			options.headers['content-type'] = 'application/x-www-form-urlencoded;charset=utf-8';
		}
		const http_options = merge_deep(this.request_settings, options);
		const response = await axios.post(`${this.base_url}${path}`, post_data, http_options);
		return response;
	}
	async _makeGetRequest(path, url_parameters = {}, options = {}) {
		return await axios.get(`${this.base_url}${path}`, { params: url_parameters, ...options, ...this.request_settings });
	}
	async _makePatchRequest(path, post_data, as_urlencoded = true, options = { headers: {} }) {
		if (as_urlencoded) {
			post_data = qs.stringify(post_data);
			options.headers['content-type'] = 'application/x-www-form-urlencoded;charset=utf-8';
		}
		const http_options = merge_deep(this.request_settings, options);
		return await axios.patch(`${this.base_url}${path}`, post_data, http_options);
	}
	async _makeDeleteRequest(path) {
		return await axios.delete(`${this.base_url}${path}`, this.request_settings);
	}
	async _makePutRequest(path, post_data, as_urlencoded = true, options = { headers: {} }) {
		if (as_urlencoded) {
			post_data = qs.stringify(post_data);
			options.headers['content-type'] = 'application/x-www-form-urlencoded;charset=utf-8';
		}
		const http_options = merge_deep(this.request_settings, options);
		return await axios.put(`${this.base_url}${path}`, post_data, http_options);
	}
	_generateMD5Hash(file) {
		return new Promise((resolve) => {
			let hash = crypto.createHash(`md5`);
			let file_stream = fs.createReadStream(file);

			file_stream.on('data', (d) => { hash.update(d); });
			file_stream.on('end', () => {
				const hash_complete = hash.digest('hex');
				resolve(hash_complete);
			});
		});
	}
	_checkResponseCode(response, status = 200) {
		if (response.status !== status) {
			return false;
		}
		return response;
	}

	// ─── POSTS ──────────────────────────────────────────────────────────────────────
	/**
	 * Search for posts using tags.
	 * @param {Object} [options]
	 * @param {string} [options.tags] - A space separated list of tags to search for.
	 * @param {number} [options.page=0] - The page to return. 
	 * @param {number} [options.post_limit=50] - The limit of posts to return.
	 * @returns {Promise}
	 */
	async postsList({ tags, page = 0, limit = 50 } = {}) {
		let params = new RequestParameters();
		params.add(`tags`, tags);
		params.add(`page`, page);
		params.add(`limit`, limit);

		return this._checkResponseCode(await this._makeGetRequest('/posts.json', params.list()));
	}

	/**
	 * Create posts from a local file or url.
	 * @param {string} file - A URL or a file directory of the file you wish to upload
	 * @param {string} tags - A space separated list of tags to apply to the post 
	 * @param {string} rating - The rating for the post. "e", "q", or "s" for explicit, questionable, or safe.
	 * @param {string} source - The URL(s) for the source. 
	 * @param {Object} [optional] - Optional values for creating a post.
	 * @param {string} [optional.description] - The description of the post.
	 * @param {string} [optional.parent_id] - The parent ID of the post.
	 * @param {string} [optional.md5_confirmation] - The MD5 hash of the file to upload.
	 * @returns {Promise}
	 */
	async postsCreate(file, tags, rating, source, { description, parent_id, md5_confirmation } = {}) {
		if (!file || !tags || !rating || !source) throw new Error(`You are missing the following parameters:\n ${file ? '' : '"file "'}${tags ? '' : '"tags "'}${rating ? '' : '"rating "'}${source ? '' : '"source"'}`);
		let params = new FormData();
		let rating_formated;

		if (['e', 'explicit'].includes(rating)) rating_formated = 'e';
		if (['q', 'questionable'].includes(rating)) rating_formated = 'q';
		if (['s', 'safe'].includes(rating)) rating_formated = 's';

		if (is_url(file))
			params.append('upload[direct_url]', file);
		else {
			params.append('upload[file]', fs.createReadStream(file));
			if (!md5_confirmation) md5_confirmation = await this._generateMD5Hash(file);
		}

		//params.append('upload[md5_confirmation]', md5_confirmation); // FIXME: MD5 confirmation fails?
		params.append('upload[tag_string]', tags);
		params.append('upload[rating]', rating_formated);
		params.append('upload[source]', source);
		if (description) params.append('upload[description]', description);
		if (parent_id) params.append('upload[parent_id]', parent_id);
		try {
			return this._checkResponseCode(await this._makePostRequest('/uploads.json', params, false, { headers: params.getHeaders() }));
		} catch (response) {
			return response;
		}
	}

	/**
	 * Vote on a post.
	 * @param {string} post_id - The ID of the post you want to vote on
	 * @param {number} score - The score to give the post.
	 * @param {object} [optional] - Optional parameters
	 * @param {boolean} [optional.no_unvote=false] - Have this vote override any previous vote.
	 * @returns {Promise}
	 */
	async postsVote(post_id, score, { no_unvote = false } = {}) {
		if (!post_id || !score) throw new Error(`You are missing the following parameters:\n ${post_id ? '' : '"post_id "'}${score ? '' : '"score "'}`);
		if (!['up', 'down'].includes(score)) throw new Error(`score must be either "up", or "down"! Got ${score}`);

		const score_map = { up: 1, down: -1 };

		let params = new RequestParameters();
		params.add(`score`, score_map[score]);
		params.add(`no_unvote`, no_unvote);

		return this._checkResponseCode(await this._makePostRequest(`/posts/${post_id}/votes.json`, params.list()));
	}

	/**
	 * Add a post to the favorites list.
	 * @param {string} post_id - The ID of the post to favorite.
	 * @param {object} [optional] - Optional parameters.
	 * @param {boolean} [optional.favorite=true] - Set to true to add to favorites, set to false to remove from favorites.
	 * @returns {Promise}
	 */
	async postsFavorite(post_id, { favorite = true } = {}) {
		let params = new RequestParameters();
		let fav_formatted;

		if (!post_id) throw new Error(`post_id must be specified! Got ${post_id}`);
		if (favorite != 1 && favorite != -1) throw new Error(`favorite must be either "1" or "-1"! Got ${favorite}`);

		if (['up', 1, '1', 'favorite', true].includes(favorite)) fav_formatted = 1;
		else if (['down', -1, '-1', 'unfavorite', false].includes(favorite)) fav_formatted = -1;

		params.add(`favorite`, fav_formatted);

		if (fav_formatted === 1) {
			params.add(`post_id`, post_id);
			return this._checkResponseCode(await this._makePostRequest(`/favorites.json`, params.list()));
		}
		else {
			return this._checkResponseCode(await this._makeDeleteRequest(`/favorites/${post_id}.json`, params.list()));
		}
	}

	/**
	 * Mark posts for deletion.
	 * @param {string} post_id - The ID of the post to delete.
	 * @param {string} reason  - The reason to mark the post for deletion.
	 * @param {object} [optional] - Optional parameters
	 * @param {boolean} [optional.delete_post=true] - Set to "true" to delete the post. Set to "false" to undelete it.
	 * @returns {Promise}
	 */
	async postsDelete(post_id, { reason, delete_post = true } = {}) {
		if (delete_post && !reason) throw new Error('You must supply a reason for a post deletion.');
		let params = new RequestParameters();

		params.add(`reason`, reason);

		if (delete_post) {
			params.add(`commit`, `Delete`);
			return this._checkResponseCode(await this._makePostRequest(`/moderator/post/posts/${post_id}/delete.json`, params.list()));
		}
		else {
			return this._checkResponseCode(await this._makePostRequest(`/moderator/post/posts/${post_id}/undelete.json`, params.list()));
		}
	}

	/**
	 * Destroys a post.
	 * @param {string} post_id - The post ID of the post to destroy.
	 * @returns {Promise}
	 */
	async postsDestroy(post_id) {
		return this._checkResponseCode(await this._makePostRequest(`/moderator/post/posts/${post_id}/expunge.json`));
	}

	/**
	 * Update a post
	 * @param {string} post_id - The target post.
	 * @param {Object} [optional] - Different options for a post you can change.
	 * @param {string} [options.tag_string_diff] - A space separated list of tag changes.
	 * @param {string} [option.source_diff] - A space separated list of 'https' source changes.
	 * @param {string} [option.parent_id] - The id of the parent post.
	 * @param {string} [option.description] - The description of the post.
	 * @param {string} [option.rating] - The rating of the post.
	 * @param {string} [option.edit_reason] - The reason of the edit.
	 * @param {boolean} [option.lock_rating] - Lock the rating of the post.
	 * @param {boolean} [option.lock_notes] - Lock the notes on the post.
	 * @returns {Promise}
	 */
	async postsUpdate(post_id, { tag_string_diff, source_diff, parent_id, description, rating, edit_reason, lock_rating, lock_notes } = {}) {
		let params = new RequestParameters(`post`);
		params.add(`tag_string_diff`, tag_string_diff);
		params.add(`source_diff`, source_diff.replace(' ', '\n'));
		params.add(`parent_id`, parent_id);
		params.add(`description`, description);
		params.add(`rating`, rating);
		params.add(`edit_reason`, edit_reason);
		params.add(`is_rating_locked`, lock_rating);
		params.add(`is_note_locked`, lock_notes);

		return this._checkResponseCode(await this._makePatchRequest(`/posts/${post_id}.json`, params.list()));
	}

	// TODO: Farther development needed.
	// /**
	//  * Approve or unapprove a post.
	//  * @param {string} post_id - The ID of the post to approve.
	//  * @param {object} [optional] - Optional parameters
	//  * @param {boolean} [optional.approve] - Set to "true" to approve the post. Set to "false" to unapprove it.
	//  * @returns { Promise }
	//  */
	// async postsApprove(post_id, { approve = true } = {}) {
	// 	let params = new RequestParameters();

	// 	params.add(`post_id`, post_id);
	// 	if (approve) return this._checkResponseCode(await this._makePostRequest(`/moderator/post/approval.json`, params.list()));
	// 	else return this._checkResponseCode(await this._makeDeleteRequest(`/moderator/post/approval.json`, params.list()));
	// };

	/*
	What are these?
	async postsReport(post_id, reason) { }

	async postsUpdateIQDB(post_id) { 
			return this._checkResponseCode(await this._makeGetRequest(`/posts/${post_id}/update_iqdb`, params.list()));
	} 
	*/

	// ─── FLAGS ──────────────────────────────────────────────────────────────────────
	/**
	 * List flags created on posts.
	 * @param {Object} options Options in listing post flags.
	 * @param {string} [options.creator_id] - Filter based on the id of the creator.
	 * @param {string} [options.post_id] - Filter based on the post ID.
	 * @param {string} [options.creator_name] - Filter based on the account name.
	 * @param {number} [options.limit] - The maximum amount of search results to return.
	 */
	async postsFlagList({ creator_id, post_id, creator_name, limit } = {}) {
		let params = new RequestParameters();
		params.add(`creator_id`, creator_id);
		params.add(`post_id`, post_id);
		params.add(`creator_name`, creator_name);
		params.add(`limit`, limit);

		return this._checkResponseCode(await this._makeGetRequest(`/post_flags.json`, params.list()));
	}
	/**
	 * Create a flag on a post.
	 * @param {string} post_id - The ID of the target post.
	 * @param {string} reason_name - One of "dnp_artist", "pay_content", "trace", "previously_deleted", "real_porn", "corrupt", "inferior", or "user".
	 * @param {Object} [optional]
	 * @param {string} [optional.parent_id] - Required if reason_name = "inferior", the ID of the superior post.
	 */
	async postsFlagCreate(post_id, reason_name, { parent_id } = {}) {
		if (!post_id || !reason_name) throw new Error(`You are missing the following parameters:\n ${reason_name ? '' : '"reason_name "'}${post_id ? '' : '"post_id "'}`);

		let params = new RequestParameters(`post_flag`);
		const reason_list = ["dnp_artist", "pay_content", "trace", "previously_deleted", "real_porn", "corrupt", "inferior", "user"];

		if (!reason_list.includes(reason_name)) throw new Error(`No valid reason label supplied!\nMust be one of '"dnp_artist", "pay_content", "trace", "previously_deleted", "real_porn", "corrupt", "inferior", "user"'`);
		if (reason_name === `inferior` && !parent_id) throw new Error(`Parent ID must be supplied when flagging a post as inferior`);

		params.add(`post_id`, post_id);
		params.add(`reason_name`, reason_name);
		params.add(`parent_id`, parent_id);

		return this._checkResponseCode(await this._makePostRequest(`/post_flags.json`, params.list()), 201);
	}


	// ─── TAGS ───────────────────────────────────────────────────────────────────────
	//REVIEW: Category as string & number?
	// TODO: Unsure what category is.
	/**
	 * Find and lists available tags.
	 * @param {Object} options - The options.
	 * @param {string} [options.name_matches] - Filter by the name of the tag.
	 * @param {number} [options.category] - Filter by the category of the tag.
	 * @param {string} [options.order=date] - Change the sort order based on "date", "count", or "name".
	 * @param {string} [options.hide_empty=true] - Hide tags with zero visible posts.
	 * @param {string} [options.has_wiki=""] - Show tags with or without a wiki. Pass "true", "false", or "".
	 * @param {string} [options.has_artist=""] - Show tags that are or are not artists. Pass "true", "false", or "".
	 * @param {string} [options.limit=75] - Limit the maximum number of tags to request for. Maximum of 1000.
	 * @param {string} [options.page=0] - The page that will be returned.
	 */
	async tagsList({ name_matches, category, order = "date", hide_empty = true, has_wiki = "", has_artist = "", limit = 75, page = 0 } = {}) {
		let params = new RequestParameters(`search`);
		params.add(`name_matches`, name_matches);
		params.add(`category`, category);
		params.add(`order`, order);
		params.add(`hide_empty`, hide_empty);
		params.add(`has_wiki`, has_wiki);
		params.add(`has_artist`, has_artist);
		params.add(`limit`, limit, true);
		params.add(`page`, page, true);

		return this._checkResponseCode(await this._makeGetRequest(`/tags.json`, params.list()));
	}

	/**
	 * List tag aliases.
	 * @param {Object} [options] - Options when listing tag aliases.
	 * @param {string} [options.name_matches] - Tag name expression to match against.
	 * @param {string} [options.status] - Filter by status.
	 * @param {string} [options.order] - Change the sort order.
	 * @param {string} [options.antecedent_tag] - Filter for antecedent tag.
	 * @param {string} [options.consequent_tag] - Filter for consequent tag.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 * @param {string} [options.page] - The page to be returned.
	 */
	async tagAliasesList({ name_matches, status, order, antecedent_tag, consequent_tag, limit, page } = {}) {
		let params = new RequestParameters(`search`);

		const post_statuses = [`approved`, `active`, `pending`, `deleted`, `retired`, ` processing`, `queued`];
		const orders = [`status`, `created_at`, `updated_at`, `name`, `tag_count`];

		if (!post_statuses.includes(status)) throw new Error(`status must be one of ${post_statuses}.`);
		if (!orders.includes(order)) throw new Error(`order must be one of ${orders}.`);

		params.add(`name_matches`, name_matches);
		params.add(`status`, status);
		params.add(`order`, order);
		params.add(`antecedent_tag`, antecedent_tag);
		params.add(`consequent_tag`, consequent_tag);
		params.add(`limit`, limit, true);
		params.add(`page`, page, true);

		return this._checkResponseCode(await this._makeGetRequest(`/tags.json`, params.list()));
	}

	// ─── NOTES ──────────────────────────────────────────────────────────────────────
	/**
	 * List notes
	 * @param {Object} [search_options] - Options when listing notes.
	 * @param {string} [search_options.body_matches] - The notes contents to match against.
	 * @param {string} [search_options.note_id] - Search for notes based on ID.
	 * @param {string} [search_options.post_tags_match] - Search for notes based on their parent post's tags.
	 * @param {string} [search_options.creator_name] - Filter based on the creator's name of the note.
	 * @param {string} [search_options.creator_id] - Filter based on the creator's ID of the note.
	 * @param {boolean} [search_options.is_active] - Filter based on the notes status. 
	 * @param {string} [search_options.limit] - The maximum amount of search results to return.
	 */
	async notesList({ body_matches, note_id, post_tags_match, creator_name, creator_id, is_active, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`body_matches`, body_matches);
		params.add(`note_id`, note_id);
		params.add(`post_tags_match`, post_tags_match);
		params.add(`creator_name`, creator_name);
		params.add(`creator_id`, creator_id);
		params.add(`is_active`, is_active);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/notes.json`, params.list()));
	}

	/**
	 * Create a note on a post
	 * @param {string} post_id - The target post's ID.
	 * @param {string} x - The x coordinate of the top left of the note in pixels, from the top left of the post.
	 * @param {string} y - The y coordinate of the top left of the note in pixels, from the top left of the post.
	 * @param {string} width - The width of the note.
	 * @param {string} height - The height of the note.
	 * @param {string} body - The contents of the note.
	 */
	async notesCreate(post_id, x, y, width, height, body) {
		let params = new RequestParameters(`note`);

		if (!post_id) throw new Error(`post_id must be supplied!`);
		if (!x) throw new Error(`x must be supplied!`);
		if (!y) throw new Error(`y must be supplied!`);
		if (!width) throw new Error(`width must be supplied!`);
		if (!height) throw new Error(`height must be supplied!`);
		if (!body) throw new Error(`body must be supplied!`);

		params.add(`post_id`, post_id);
		params.add(`x`, x);
		params.add(`y`, y);
		params.add(`width`, width);
		params.add(`height`, height);
		params.add(`body`, body);

		return this._checkResponseCode(await this._makePostRequest(`/notes.json`, params.list()));
	}

	/**
	 * Update a note.
	 * @param {string} note_id - The ID of the note to update.
	 * @param {string} x - The x coordinate of the top left of the note in pixels, from the top left of the post.
	 * @param {string} y - The y coordinate of the top left of the note in pixels, from the top left of the post.
	 * @param {string} width - The width of the note.
	 * @param {string} height - The height of the note.
	 * @param {string} body  - The contents of the note.
	 */
	async notesUpdate(note_id, x, y, width, height, body) {
		let params = new RequestParameters(`note`);

		if (!note_id) throw new Error(`note_id must be supplied!`);
		if (!x) throw new Error(`x must be supplied!`);
		if (!y) throw new Error(`y must be supplied!`);
		if (!width) throw new Error(`width must be supplied!`);
		if (!height) throw new Error(`height must be supplied!`);
		if (!body) throw new Error(`body must be supplied!`);

		params.add(`x`, x);
		params.add(`y`, y);
		params.add(`width`, width);
		params.add(`height`, height);
		params.add(`body`, body);

		return this._checkResponseCode(await this._makePutRequest(`/notes/${note_id}.json`, params.list()));
	}

	/**
	 * Delete a note.
	 * @param {string} note_id - The ID of the note to delete.
	 */
	async notesDelete(note_id) {
		if (!note_id) throw new Error(`note_id must be supplied! Got ${note_id}`);

		return this._checkResponseCode(await this._makeDeleteRequest(`/notes/${note_id}.json`));
	}

	/**
	 * Revert a note to a previous version.
	 * @param {string} note_id - The target note's ID.
	 * @param {string} version_id - The version ID of the note to revert to.
	 */
	async notesRevert(note_id, version_id) {
		let params = new RequestParameters();

		if (!note_id) throw new Error(`note_id must be supplied! Got ${note_id}`);
		if (!version_id) throw new Error(`version_id must be supplied! Got ${version_id}`);

		params.add(`version_id`, version_id);

		return this._checkResponseCode(await this._makePutRequest(`/notes/${note_id}/revert.json`, params.list()), 204);
	}

	/* ---------------------------------- Pools --------------------------------- */
	/**
	 * List pools.
	 * @param {Object} options - Options.
	 * @param {string} [options.name_matches] - Filter pools based on their name. 
	 * @param {string} [options.id] - Find pool based on ID.
	 * @param {string} [options.description_matches] - Filter pools based on their description.
	 * @param {string} [options.creator_name] - Filter pools based on their creator name.
	 * @param {string} [options.creator_id] - Filter pools based on their creator ID.
	 * @param {boolean} [options.is_active] - Filter based on active status. Can be "true", "false", or blank.
	 * @param {boolean} [options.is_deleted] - Filter based on deletion status. Can be "true", "false", or blank.
	 * @param {string} [options.category] - Filter based on the category string name.
	 * @param {string} [options.order] - Change the order of the results.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 */
	async poolsList({ name_matches, id, description_matches, creator_name, creator_id, is_active, is_deleted, category, order, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`name_matches`, name_matches);
		params.add(`id`, id);
		params.add(`description_matches`, description_matches);
		params.add(`creator_name`, creator_name);
		params.add(`creator_id`, creator_id);
		params.add(`is_active`, is_active);
		params.add(`is_deleted`, is_deleted);
		params.add(`category`, category);
		params.add(`order`, order);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/pools.json`, params.list()));
	}
	/**
	 * Create a pool.
	 * @param {string} name - The name of the pool.
	 * @param {string} category - The category of the pool.
	 * @param {Object} optional
	 * @param {string} [optional.description] - The description of the pool.
	 * @param {boolean} [optional.is_locked] - If the pool is locked. True or false.
	 */
	async poolsCreate(name, category, { description = "", is_locked } = {}) {
		let params = new RequestParameters(`pool`);

		if (!name) throw new Error(`name must be supplied! Got ${name}`);
		if (!category) throw new Error(`category must be supplied! Got ${category}`);
		if (![`series`, `collection`].includes(category)) throw new Error(`Category can be one of “series” or “collection”. Got ${category}`);

		params.add(`name`, name);
		params.add(`category`, category);
		params.add(`description`, description);
		params.add(`is_locked`, is_locked);

		return this._checkResponseCode(await this._makePostRequest(`/pools.json`, params.list()));
	}
	/**
	 * Update a post.
	 * @param {string} pool_id - The target pool ID.
	 * @param {Object} options
	 * @param {string} [options.name] - The name of the pool.
	 * @param {string} [options.description] - The description of the pool.
	 * @param {string} [options.post_ids] - IDs of posts to add to the pool.
	 * @param {string} [options.is_active] - The active state of the pool.
	 * @param {string} [options.category] - The category of the pool.
	 */
	async poolsUpdate(pool_id, { name, description, post_ids, is_active, category } = {}) {
		let params = new RequestParameters(`pool`);

		if (!pool_id) throw new Error(`pool_id must be supplied! Got ${pool_id}`);
		if (category && ![`series`, `collection`].includes(category)) throw new Error(`Category can be one of “series” or “collection”. Got ${category}`);

		params.add(`name`, name);
		params.add(`description`, description);
		params.add(`post_ids`, post_ids);
		params.add(`is_active`, is_active);
		params.add(`category`, category);

		return this._checkResponseCode(await this._makePutRequest(`/pools/${pool_id}.json`, params.list()));
	}

	/**
	 * Revert a post to a previous version.
	 * @param {string} pool_id - The ID of the pool.
	 * @param {string} version_id - The version ID of the note to revert to.
	 */
	async poolsRevert(pool_id, version_id) {
		let params = new RequestParameters();

		if (!pool_id) throw new Error(`pool_id must be supplied! Got ${pool_id}`);
		if (!version_id) throw new Error(`version_id must be supplied! Got ${version_id}`);

		params.add(`version_id`, version_id);

		return this._checkResponseCode(await this._makePutRequest(`/pools/${pool_id}.json`, params.list()));
	}

	/* -------------------------------- Accounts -------------------------------- */
	// REVIEW: Review can_approve_posts. true/false/undefined?
	// REVIEW: Review can_upload_free. true/false/undefined?
	/**
	 * Search accounts
	 * @param {Object} options 
	 * @param {string} [options.account_id] - The account ID of the user.
	 * @param {string} [options.level] - Filter by the level of the user.
	 * @param {boolean} [options.can_approve_posts] - Filter by users who can approve posts.
	 * @param {boolean} [options.can_upload_free] - Filter by users who can upload freely without a review.
	 * @param {number} [options.limit] - The maximum amount of search results to return.
	 */
	async accountList({ account_id, level, can_approve_posts, can_upload_free, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`account_id`, account_id);
		params.add(`level`, level);
		params.add(`can_approve_posts`, can_approve_posts);
		params.add(`can_upload_free`, can_upload_free);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/users.json`, params.list()));
	}

	/**
	 * Get an account by name.
	 * @param {string} [name] - The Username of the account to get.
	 * @returns {Promise}
	 */
	async getAccount(name = this.username) {
		return this._checkResponseCode(await this._makeGetRequest(`/users/${name}.json`));
	}
	/* --------------------------------- Generic -------------------------------- */

	/**
	 * List Wiki pages.
	 * @param {Object} options
	 * @param {string} [options.id] - The ID of the wiki to search.
	 * @param {string} [options.title] - Filter by the title of the wiki page.
	 * @param {string} [options.creator_id] - Filter by the account ID of the creator.
	 * @param {string} [options.creator_name] - Filter by the name of the creator.
	 * @param {boolean} [options.is_locked] - Filter by lock status. true, false, or undefined.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 */
	async wikiList({ id, title, creator_id, creator_name, is_locked, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`id`, id);
		params.add(`title`, title);
		params.add(`creator_id`, creator_id);
		params.add(`creator_name`, creator_name);
		params.add(`is_locked`, is_locked);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/wiki_pages.json`, params.list()));
	}

	/**
	 * List tag implications
	 * @param {Object} options
	 * @param {string} [options.id] - The ID of the tag implication.
	 * @param {string} [options.antecedent_name] - Filter by antecedent name.
	 * @param {string} [options.consequent_name] - Filter by consequent name.
	 * @param {string} [options.status] - Filter by status.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 */
	async tagImplicationsList({ id, antecedent_name, consequent_name, status, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`id`, id);
		params.add(`antecedent_name`, antecedent_name);
		params.add(`consequent_name`, consequent_name);
		params.add(`status`, status);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/tag_implications.json`, params.list()));
	}

	/**
	 * List post sets.
	 * @param {Object} options
	 * @param {string} [options.id] - The ID of the post set to search for.
	 * @param {string} [options.creator_id] - Filter by the creator ID.
	 * @param {string} [options.name] - Filter by the name of the set.
	 * @param {string} [options.short_name] - Filter by the short name of the set.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 */
	async postSetsList({ id, creator_id, name, short_name, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`id`, id);
		params.add(`creator_id`, creator_id);
		params.add(`name`, name);
		params.add(`short_name`, short_name);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/post_sets.json`, params.list()));
	}

	/**
	 * List blips.
	 * @param {Object} options
	 * @param {string} [options.id] - Filter by the ID of the blip.
	 * @param {string} [options.creator_id] - Filter by the creator ID of the blip.
	 * @param {string} [options.creator_name] - Filter by the creator name of the blip.
	 * @param {string} [options.response_to] - Filter by the response target of the blip.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 */
	async blipsList({ id, creator_id, creator_name, response_to, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`id`, id);
		params.add(`creator_id`, creator_id);
		params.add(`creator_name`, creator_name);
		params.add(`response_to`, response_to);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/blips.json`, params.list()));
	}

	/**
	 * List user feedback.
	 * @param {Object} options 
	 * @param {string} [options.id] - Filter by the ID of the feedback.
	 * @param {string} [options.user_id] - Filter by the ID of the target user.
	 * @param {string} [options.creator_id] - Filter by the ID of the user who issued the feedback.
	 * @param {string} [options.category] - Filter by feedback category.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 */
	async userFeedbackList({ id, user_id, creator_id, category, limit } = {}) {
		let params = new RequestParameters(`search`);

		if (category && !["positive", "negative", "neutral"].includes(category)) throw new Error(`Category must be one of "positive", "negative", "neutral"! Got ${category}`);

		params.add(`id`, id);
		params.add(`user_id`, user_id);
		params.add(`creator_id`, creator_id);
		params.add(`category`, category);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/user_feedbacks.json`, params.list()));
	}

	// REVIEW: What is required bu category ID? Check enums!
	// REVIEW: Can booleans also use undefined?
	/**
	 * List forum topics
	 * @param {Object} options
	 * @param {string} [options.id] - Filter by the ID of the forum topic.
	 * @param {boolean} [options.is_sticky] - Filter by the stick status.
	 * @param {boolean} [options.is_locked] - Filter by the lock status.
	 * @param {string} [options.category_id] - Filter by the category ID.
	 * @param {string} [options.limit] - The maximum amount of search results to return.
	 */
	async forumTopicsList({ id, is_sticky, is_locked, category_id, limit } = {}) {
		let params = new RequestParameters(`search`);

		params.add(`id`, id);
		params.add(`is_sticky`, is_sticky);
		params.add(`is_locked`, is_locked);
		params.add(`category_id`, category_id);
		params.add(`limit`, limit, true);

		return this._checkResponseCode(await this._makeGetRequest(`/forum_topics.json`, params.list()));
	}

	/* 	async newsUpdate(message) {
			let params = new RequestParameters(`news_update`);
	
			params.add('message', message);
			return this._checkResponseCode(await this._makePostRequest(`/posts/${post_id}/votes.json`, params.list()));
		} */
}

/* ------------------------- Enums and user helpers ------------------------- */

class RequestParameters {
	constructor(wrapper) {
		this.params = {};
		this.wrapper = wrapper;
	}

	add(name, param, no_wrap = false) {
		if (!param) return;
		if (no_wrap || !this.wrapper) this.params[name] = param;
		else this.params[`${this.wrapper}[${name}]`] = param;
	}

	list() {
		return this.params;
	}
}

enums = {
	tag_categories: {
		"0": `general`,
		"1": `artist`,
		"3": `copyright`,
		"4": `character`,
		"5": `species`,
		"6": `invalid`,
		"7": `meta`,
		"8": `lore`,

		"general": "0",
		"artist": "1",
		"copyright": "3",
		"character": "4",
		"species": "5",
		"invalid": "6",
		"meta": "7",
		"lore": "8"
	},
	post_reporting: {
		'1': 'Rating Abuse',
		'2': 'Malicious File',
		'3': 'Malicious Sources',
		'4': 'Description Abuse',
		'5': 'Note Abuse',
		'6': 'Tagging Abuse',

		'Rating Abuse': '1',
		'Malicious File': '2',
		'Malicious Sources': '3',
		'Description Abuse': '4',
		'Note Abuse': '5',
		'Tagging Abuse': '6'
	},
	forum_topic_categories: {
		"1": "General",
		"11": "Site Bug Reports & Feature Requests",
		"10": "Tag/Wiki Projects and Questions",
		"2": "Tag Alias and Implication Suggestions",
		"3": "Art Talk",
		"5": "Off Topic",
		"9": "e621 Tools and Applications",

		"General": "1",
		"Site Bug Reports & Feature Requests": "11",
		"Tag/Wiki Projects and Questions": "10",
		"Tag Alias and Implication Suggestions": "2",
		"Art Talk": "3",
		"Off Topic": "5",
		"e621 Tools and Applications": "9"
	},
	account_levels: {
		"20": "Member",
		"30": "Privileged",
		"33": "Contributor",
		"34": "Former Staff",
		"35": "Janitor",
		"50": "Admin",

		"Member": "20",
		"Privileged": "30",
		"Contributor": "33",
		"Former Staff": "34",
		"Janitor": "35",
		"Admin": "50"
	}
};

module.exports = { e621, enums };